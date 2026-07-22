import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  async create(data: any): Promise<Ticket> {
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

      // Notify assignee if assigned on creation
      if (ticket.assigneeId && ticket.assignee) {
        const subject = `Nouveau ticket assigné : ${ticket.title}`;
        const text = `Bonjour ${ticket.assignee.firstName},\n\nLe ticket "${ticket.title}" (Priorité: ${ticket.priority || 'MEDIUM'}) vous a été assigné.\n\nDescription :\n${ticket.description}\n\nRendez-vous sur l'application pour le traiter.`;
        const html = `<p>Bonjour ${ticket.assignee.firstName},</p>
<p>Le ticket <b>"${ticket.title}"</b> (Priorité: ${ticket.priority || 'MEDIUM'}) vous a été assigné.</p>
<p><b>Description :</b><br/>${ticket.description}</p>
<p><a href="https://app.kpsyinformatique.com/">Accéder à l'espace de support</a></p>`;

        this.mailService.sendMail(ticket.assignee.email, subject, text, html).catch(() => {});
      }

      // Notify creator about the ticket creation
      if (ticket.creator && ticket.creator.email && ticket.creator.email !== 'system@kpsydesk.local') {
        const creatorSubject = `[KPSyDesk] Confirmation d'ouverture de ticket - ${ticket.title}`;
        const creatorText = `Bonjour ${ticket.creator.firstName},\n\nVotre ticket "${ticket.title}" (Priorité: ${ticket.priority || 'MEDIUM'}) a été créé avec succès.\n\nDescription :\n${ticket.description}\n\nUn technicien va le prendre en charge dans les plus brefs délais.\n\nMerci de votre confiance.`;
        const creatorHtml = `<p>Bonjour ${ticket.creator.firstName},</p>
<p>Votre ticket <b>"${ticket.title}"</b> (Priorité: ${ticket.priority || 'MEDIUM'}) a été créé avec succès.</p>
<p><b>Description :</b><br/>${ticket.description}</p>
<p>Un technicien va le prendre en charge dans les plus brefs délais.</p>
<p>Merci de votre confiance.</p>
<p><a href="https://app.kpsyinformatique.com/">Accéder à votre espace client</a></p>`;

        this.mailService.sendMail(ticket.creator.email, creatorSubject, creatorText, creatorHtml).catch(() => {});
      }

      return ticket;
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException(`L'utilisateur ou l'équipement spécifié n'existe pas.`);
      }
      throw error;
    }
  }

  async update(id: string, data: any): Promise<Ticket> {
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

      const updatedTicket = await this.prisma.ticket.update({
        where: { id },
        data: prismaData,
        include: { assignee: true, creator: true, asset: true },
      });

      // Notify new assignee if changed
      if (prismaData.assigneeId && currentTicket.assigneeId !== prismaData.assigneeId && updatedTicket.assignee) {
        const subject = `Nouveau ticket assigné : ${updatedTicket.title}`;
        const text = `Bonjour ${updatedTicket.assignee.firstName},\n\nLe ticket "${updatedTicket.title}" (Priorité: ${updatedTicket.priority || 'MEDIUM'}) vous a été assigné.\n\nDescription :\n${updatedTicket.description}\n\nRendez-vous sur l'application pour le traiter.`;
        const html = `<p>Bonjour ${updatedTicket.assignee.firstName},</p>
<p>Le ticket <b>"${updatedTicket.title}"</b> (Priorité: ${updatedTicket.priority || 'MEDIUM'}) vous a été assigné.</p>
<p><b>Description :</b><br/>${updatedTicket.description}</p>
<p><a href="https://app.kpsyinformatique.com/">Accéder à l'espace de support</a></p>`;

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

  async remove(id: string): Promise<Ticket> {
    try {
      await this.prisma.ticketComment.deleteMany({
        where: { ticketId: id },
      });
      return await this.prisma.ticket.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Ticket introuvable.`);
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<Ticket> {
    return this.prisma.ticket.update({
      where: { id },
      data: { status },
    });
  }

  async assign(id: string, assigneeId: string): Promise<Ticket> {
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
      include: { assignee: true }
    });

    // Notify new assignee if changed and exists
    if (assigneeId && currentTicket.assigneeId !== assigneeId && updatedTicket.assignee) {
      const subject = `Nouveau ticket assigné : ${updatedTicket.title}`;
      const text = `Bonjour ${updatedTicket.assignee.firstName},\n\nLe ticket "${updatedTicket.title}" (Priorité: ${updatedTicket.priority}) vous a été assigné.\n\nDescription :\n${updatedTicket.description}\n\nRendez-vous sur l'application pour le traiter.`;
      const html = `<p>Bonjour ${updatedTicket.assignee.firstName},</p>
<p>Le ticket <b>"${updatedTicket.title}"</b> (Priorité: ${updatedTicket.priority}) vous a été assigné.</p>
<p><b>Description :</b><br/>${updatedTicket.description}</p>
<p><a href="https://app.kpsyinformatique.com/">Accéder à l'espace de support</a></p>`;

      // Envoi asynchrone non-bloquant
      this.mailService.sendMail(updatedTicket.assignee.email, subject, text, html).catch(() => {});
    }

    return updatedTicket;
  }
}
