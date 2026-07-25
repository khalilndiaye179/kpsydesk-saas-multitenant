import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Ticket } from '@prisma/client';
import { MailService } from '../mail/mail.service';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService
  ) {}

  async findAll(): Promise<Ticket[]> {
    return this.prisma.ticket.findMany({
      include: {
        creator: true,
        assignee: true,
        asset: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForUser(creatorId: string): Promise<Ticket[]> {
    return this.prisma.ticket.findMany({
      where: { creatorId },
      include: {
        creator: true,
        assignee: true,
        asset: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        creator: true,
        assignee: true,
        asset: true,
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket avec l'ID ${id} introuvable`);
    }
    return ticket;
  }

  async create(data: any, currentUser?: any): Promise<Ticket> {
    try {
      let creatorId = data.creatorId;
      if (creatorId) {
        const userExists = await this.prisma.user.findUnique({ where: { id: creatorId } });
        if (!userExists) creatorId = null;
      }
      
      if (!creatorId) {
        const firstUser = await this.prisma.user.findFirst();
        if (firstUser) {
          creatorId = firstUser.id;
        } else {
          const sysUser = await this.prisma.user.create({
            data: {
              email: 'system@kpsydesk.local',
              password: 'none',
              firstName: 'System',
              lastName: 'Admin',
              role: 'ADMIN'
            }
          });
          creatorId = sysUser.id;
        }
      }

      const status = data.assigneeId ? 'IN_PROGRESS' : 'OPEN';

      const ticket = await this.prisma.ticket.create({
        data: {
          ...data,
          creatorId: creatorId,
          status,
        },
        include: {
          assignee: true,
          creator: true,
          asset: true,
        },
      });

      // Log audit for ticket creation
      await this.prisma.auditLog.create({
        data: {
          action: 'CREATION',
          entityType: 'TICKET',
          entityId: ticket.id,
          newData: JSON.parse(JSON.stringify(ticket)),
          performedBy: currentUser?.email || (ticket.creator ? ticket.creator.email : 'Système'),
          tenantId: ticket.tenantId,
        }
      }).catch(() => {});

      // Notify assignee if assigned on creation
      if (ticket.assigneeId && ticket.assignee) {
        const subject = `Nouveau ticket assigné : ${ticket.title}`;
        const text = `Bonjour ${ticket.assignee.firstName},\n\nLe ticket suivant vous a été assigné :\n\n${this.generateTicketTableText(ticket)}\n\nRendez-vous sur l'application pour le traiter.`;
        const html = `<p>Bonjour <b>${ticket.assignee.firstName}</b>,</p>
<p>Le ticket suivant vous a été assigné :</p>
${this.generateTicketTableHtml(ticket)}
<p style="margin-top: 20px;"><a href="https://app.kpsyinformatique.com/" style="background-color: #6366f1; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Accéder à l'espace de support</a></p>`;

        this.mailService.sendMail(ticket.assignee.email, subject, text, html).catch(() => {});
      }

      // Notify creator about the ticket creation
      if (ticket.creator && ticket.creator.email && ticket.creator.email !== 'system@kpsydesk.local') {
        const creatorSubject = `[KPSyDesk] Confirmation d'ouverture de ticket - ${ticket.title}`;
        const creatorText = `Bonjour ${ticket.creator.firstName},\n\nVotre ticket a été créé avec succès :\n\n${this.generateTicketTableText(ticket)}\n\nUn technicien va le prendre en charge dans les plus brefs délais.`;
        const html = `<p>Bonjour <b>${ticket.creator.firstName}</b>,</p>
<p>Votre ticket a été créé avec succès :</p>
${this.generateTicketTableHtml(ticket)}
<p>Un technicien va le prendre en charge dans les plus brefs délais.</p>
<p style="margin-top: 20px;"><a href="https://app.kpsyinformatique.com/" style="background-color: #10b981; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Accéder à votre espace client</a></p>`;

        this.mailService.sendMail(ticket.creator.email, creatorSubject, creatorText, html).catch(() => {});
      }

      return ticket;
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException(`L'utilisateur ou l'équipement spécifié n'existe pas.`);
      }
      throw error;
    }
  }

  async update(id: string, data: any, currentUser?: any): Promise<Ticket> {
    const { id: dataId, creatorId, ...prismaData } = data;
    try {
      const currentTicket = await this.prisma.ticket.findUnique({
        where: { id },
        include: { assignee: true }
      });

      if (!currentTicket) {
        throw new NotFoundException(`Ticket avec l'ID ${id} introuvable`);
      }

      // If assignee is changing, automatically set status to IN_PROGRESS
      if (prismaData.assigneeId && currentTicket.assigneeId !== prismaData.assigneeId) {
        prismaData.status = 'IN_PROGRESS';
      }

      // Intercept status changes for non-admins to prevent direct resolution/closure
      if (prismaData.status && currentUser && currentUser.role !== 'ADMIN') {
        if (prismaData.status === 'RESOLVED') {
          prismaData.status = 'PENDING_RESOLVED';
        } else if (prismaData.status === 'CLOSED') {
          prismaData.status = 'PENDING_CLOSED';
        }
      }

      if (prismaData.status) {
        if (['RESOLVED', 'PENDING_RESOLVED', 'RESOLUTION_CONFIRMED'].includes(prismaData.status)) {
          if (!currentTicket.resolvedAt) {
            prismaData.resolvedAt = new Date();
          }
        } else if (['OPEN', 'IN_PROGRESS'].includes(prismaData.status)) {
          prismaData.resolvedAt = null;
        }
      }

      const updatedTicket = await this.prisma.ticket.update({
        where: { id },
        data: prismaData,
        include: { assignee: true, creator: true, asset: true },
      });

      // Log audit for ticket update
      await this.prisma.auditLog.create({
        data: {
          action: 'MODIFICATION',
          entityType: 'TICKET',
          entityId: id,
          oldData: currentTicket ? JSON.parse(JSON.stringify(currentTicket)) : undefined,
          newData: JSON.parse(JSON.stringify(updatedTicket)),
          performedBy: currentUser?.email || 'Système',
          tenantId: updatedTicket.tenantId,
        }
      }).catch(() => {});

      // Notify creator if status transitioned to PENDING_RESOLVED
      if (updatedTicket.status === 'PENDING_RESOLVED' && currentTicket.status !== 'PENDING_RESOLVED') {
        this.notifyCreatorPendingResolution(updatedTicket);
      }

      // Notify new assignee if changed
      if (prismaData.assigneeId && currentTicket.assigneeId !== prismaData.assigneeId && updatedTicket.assignee) {
        const subject = `Nouveau ticket assigné : ${updatedTicket.title}`;
        const text = `Bonjour ${updatedTicket.assignee.firstName},\n\nLe ticket suivant vous a été assigné :\n\n${this.generateTicketTableText(updatedTicket)}\n\nRendez-vous sur l'application pour le traiter.`;
        const html = `<p>Bonjour <b>${updatedTicket.assignee.firstName}</b>,</p>
<p>Le ticket suivant vous a été assigné :</p>
${this.generateTicketTableHtml(updatedTicket)}
<p style="margin-top: 20px;"><a href="https://app.kpsyinformatique.com/" style="background-color: #6366f1; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Accéder à l'espace de support</a></p>`;

        this.mailService.sendMail(updatedTicket.assignee.email, subject, text, html).catch(() => {});
      }

      return updatedTicket;
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException(`L'utilisateur ou l'équipement spécifié n'existe pas.`);
      }
      throw error;
    }
  }

  async remove(id: string, currentUser?: any): Promise<Ticket> {
    try {
      const ticketToDelete = await this.prisma.ticket.findUnique({
        where: { id },
      });

      await this.prisma.ticketComment.deleteMany({
        where: { ticketId: id },
      });

      const deletedTicket = await this.prisma.ticket.delete({
        where: { id },
      });

      if (ticketToDelete) {
        await this.prisma.auditLog.create({
          data: {
            action: 'SUPPRESSION',
            entityType: 'TICKET',
            entityId: id,
            oldData: JSON.parse(JSON.stringify(ticketToDelete)),
            performedBy: currentUser?.email || 'Admin',
            tenantId: ticketToDelete.tenantId,
          }
        }).catch(() => {});
      }

      return deletedTicket;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Ticket introuvable.`);
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: string, currentUser?: any): Promise<Ticket> {
    const currentTicket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!currentTicket) {
      throw new NotFoundException(`Ticket avec l'ID ${id} introuvable.`);
    }

    let finalStatus = status;
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (status === 'RESOLVED') {
        finalStatus = 'PENDING_RESOLVED';
      } else if (status === 'CLOSED') {
        finalStatus = 'PENDING_CLOSED';
      }
    }

    // Règle de clôture : On interdit la clôture directe par l'ADMIN si le ticket est en PENDING_RESOLVED 
    // et a été créé après la date de déploiement (Rétrocompatibilité).
    if (finalStatus === 'CLOSED' && currentTicket.status === 'PENDING_RESOLVED') {
      const releaseDate = new Date('2026-07-25T01:30:00Z');
      if (currentTicket.createdAt >= releaseDate) {
        throw new BadRequestException("Une confirmation du créateur est requise avant la clôture par l'administrateur.");
      }
    }

    // Calcul de resolvedAt
    let resolvedAt: Date | null | undefined = undefined;
    if (['RESOLVED', 'PENDING_RESOLVED', 'RESOLUTION_CONFIRMED'].includes(finalStatus)) {
      if (!currentTicket.resolvedAt) {
        resolvedAt = new Date();
      }
    } else if (['OPEN', 'IN_PROGRESS'].includes(finalStatus)) {
      resolvedAt = null;
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: { 
        status: finalStatus,
        resolvedAt
      },
      include: { assignee: true, creator: true, asset: true },
    });

    if (currentTicket) {
      await this.prisma.auditLog.create({
        data: {
          action: 'STATUT_CHANGE',
          entityType: 'TICKET',
          entityId: id,
          oldData: { status: currentTicket.status },
          newData: { status: finalStatus },
          performedBy: currentUser?.email || 'Système',
          tenantId: currentTicket.tenantId,
        }
      }).catch(() => {});
    }

    // Déclencher la notification au créateur s'il passe à PENDING_RESOLVED
    if (updatedTicket.status === 'PENDING_RESOLVED' && currentTicket.status !== 'PENDING_RESOLVED') {
      this.notifyCreatorPendingResolution(updatedTicket);
    }

    return updatedTicket;
  }

  async assign(id: string, assigneeId: string, currentUser?: any): Promise<Ticket> {
    const currentTicket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { assignee: true }
    });

    if (!currentTicket) {
      throw new NotFoundException(`Ticket avec l'ID ${id} introuvable`);
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: { 
        assigneeId,
        status: 'IN_PROGRESS'
      },
      include: { assignee: true, creator: true, asset: true }
    });

    // Log audit for assignment
    if (currentTicket) {
      await this.prisma.auditLog.create({
        data: {
          action: 'ASSIGNATION',
          entityType: 'TICKET',
          entityId: id,
          oldData: { assigneeId: currentTicket.assigneeId },
          newData: { assigneeId },
          performedBy: currentUser?.email || 'Système',
          tenantId: currentTicket.tenantId,
        }
      }).catch(() => {});
    }

    // Notify new assignee if changed and exists
    if (assigneeId && currentTicket.assigneeId !== assigneeId && updatedTicket.assignee) {
      const subject = `Nouveau ticket assigné : ${updatedTicket.title}`;
      const text = `Bonjour ${updatedTicket.assignee.firstName},\n\nLe ticket suivant vous a été assigné :\n\n${this.generateTicketTableText(updatedTicket)}\n\nRendez-vous sur l'application pour le traiter.`;
      const html = `<p>Bonjour <b>${updatedTicket.assignee.firstName}</b>,</p>
<p>Le ticket suivant vous a été assigné :</p>
${this.generateTicketTableHtml(updatedTicket)}
<p style="margin-top: 20px;"><a href="https://app.kpsyinformatique.com/" style="background-color: #6366f1; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Accéder à l'espace de support</a></p>`;

      // Envoi asynchrone non-bloquant
      this.mailService.sendMail(updatedTicket.assignee.email, subject, text, html).catch(() => {});
    }

    return updatedTicket;
  }

  async confirmResolution(id: string, currentUser: any): Promise<Ticket> {
    const currentTicket = await this.findOne(id);

    if (currentTicket.status !== 'PENDING_RESOLVED') {
      throw new BadRequestException("Ce ticket n'est pas en attente de confirmation de résolution.");
    }

    if (currentUser.role === 'USER' && currentTicket.creatorId !== currentUser.userId) {
      throw new ForbiddenException("Seul le créateur du ticket peut confirmer sa résolution.");
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: 'RESOLUTION_CONFIRMED',
        resolvedAt: currentTicket.resolvedAt || new Date()
      },
      include: { assignee: true, creator: true, asset: true }
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'STATUT_CHANGE',
        entityType: 'TICKET',
        entityId: id,
        oldData: { status: currentTicket.status },
        newData: { status: 'RESOLUTION_CONFIRMED' },
        performedBy: currentUser?.email || 'Système',
        tenantId: currentTicket.tenantId,
      }
    }).catch(() => {});

    return updatedTicket;
  }

  async rejectResolution(id: string, commentContent: string, currentUser: any): Promise<Ticket> {
    if (!commentContent || !commentContent.trim()) {
      throw new BadRequestException("Un commentaire expliquant pourquoi le problème n'est pas résolu est obligatoire.");
    }

    const currentTicket = await this.findOne(id);

    if (currentTicket.status !== 'PENDING_RESOLVED') {
      throw new BadRequestException("Ce ticket n'est pas en attente de confirmation de résolution.");
    }

    if (currentUser.role === 'USER' && currentTicket.creatorId !== currentUser.userId) {
      throw new ForbiddenException("Seul le créateur du ticket peut contester sa résolution.");
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        resolvedAt: null
      },
      include: { assignee: true, creator: true, asset: true }
    });

    // Créer le commentaire explicatif
    await this.prisma.ticketComment.create({
      data: {
        content: commentContent,
        ticketId: id,
        authorId: currentUser.userId,
        tenantId: currentTicket.tenantId
      }
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'STATUT_CHANGE',
        entityType: 'TICKET',
        entityId: id,
        oldData: { status: currentTicket.status },
        newData: { status: 'IN_PROGRESS' },
        performedBy: currentUser?.email || 'Système',
        tenantId: currentTicket.tenantId,
      }
    }).catch(() => {});

    return updatedTicket;
  }

  private notifyCreatorPendingResolution(ticket: any) {
    if (!ticket.creator || !ticket.creator.email || ticket.creator.email === 'system@kpsydesk.local') {
      return;
    }

    const subject = `[KPSyDesk] Votre ticket est résolu - Action requise : ${ticket.title}`;
    const text = `Bonjour ${ticket.creator.firstName},\n\nLe technicien a marqué votre ticket comme résolu :\n\n${this.generateTicketTableText(ticket)}\n\nIndiquez sur l'application si vous confirmez la résolution.`;
    const html = `<p>Bonjour <b>${ticket.creator.firstName}</b>,</p>
<p>Le technicien a marqué votre ticket comme résolu :</p>
${this.generateTicketTableHtml(ticket)}
<p>Indiquez sur l'application si vous confirmez la résolution.</p>
<p style="margin-top: 20px;"><a href="https://app.kpsyinformatique.com/" style="background-color: #6366f1; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Accéder à votre espace de support</a></p>`;

    this.mailService.sendMail(ticket.creator.email, subject, text, html).catch(() => {});
  }

  private generateTicketTableHtml(ticket: any): string {
    const ticketNo = '#' + ticket.id.substring(0, 8).toUpperCase();
    const subject = ticket.title;
    const description = ticket.description;
    const creatorName = ticket.creator ? `${ticket.creator.firstName} ${ticket.creator.lastName}` : 'Anonyme';
    const assetName = ticket.asset ? `[${ticket.asset.inventoryCode}] ${ticket.asset.name}` : '-';
    const assigneeName = ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Non assigné';
    const priority = ticket.priority;
    const status = ticket.status;
    const createdDate = new Date(ticket.createdAt).toLocaleDateString('fr-FR');

    return `
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: Arial, sans-serif; font-size: 13px; color: #333;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 30%; background: #f9fafb;">N° Ticket</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; font-weight: bold; color: #6366f1;">${ticketNo}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9fafb;">Sujet</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><b>${subject}</b></td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9fafb;">Description</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${description}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9fafb;">Demandeur</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${creatorName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9fafb;">Équipement</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${assetName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9fafb;">Assigné à</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${assigneeName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9fafb;">Priorité</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #d97706;">${priority}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9fafb;">Statut</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">${status}</span></td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background: #f9fafb;">Créé le</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${createdDate}</td>
        </tr>
      </table>
    `;
  }

  private generateTicketTableText(ticket: any): string {
    const ticketNo = '#' + ticket.id.substring(0, 8).toUpperCase();
    const subject = ticket.title;
    const description = ticket.description;
    const creatorName = ticket.creator ? `${ticket.creator.firstName} ${ticket.creator.lastName}` : 'Anonyme';
    const assetName = ticket.asset ? `[${ticket.asset.inventoryCode}] ${ticket.asset.name}` : '-';
    const assigneeName = ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Non assigné';
    const priority = ticket.priority;
    const status = ticket.status;
    const createdDate = new Date(ticket.createdAt).toLocaleDateString('fr-FR');

    return `• N° Ticket : ${ticketNo}\n` +
      `• Sujet : ${subject}\n` +
      `• Description : ${description}\n` +
      `• Demandeur : ${creatorName}\n` +
      `• Équipement : ${assetName}\n` +
      `• Assigné à : ${assigneeName}\n` +
      `• Priorité : ${priority}\n` +
      `• Statut : ${status}\n` +
      `• Créé le : ${createdDate}`;
  }
}
