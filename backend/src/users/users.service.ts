import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      include: {
        department: true,
        assets: true,
      },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        assets: true, // Actifs affectés
        assignedTix: { // Tickets assignés si c'est un technicien
          where: { status: { not: 'CLOSED' } }
        }
      },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} introuvable`);
    }
    return user;
  }

  async create(data: any, currentUser?: any): Promise<User> {
    if (data.email?.toLowerCase().trim() === 'admin@entreprise.com') {
      throw new BadRequestException(
        'Cette adresse email est réservée par le système et ne peut pas être utilisée pour un utilisateur de tenant.',
      );
    }

    try {
      const createdUser = await this.prisma.user.create({
        data,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'CREATION',
          entityType: 'USER',
          entityId: createdUser.id,
          newData: { email: createdUser.email, firstName: createdUser.firstName, lastName: createdUser.lastName, role: createdUser.role },
          performedBy: currentUser?.email || 'Système',
          tenantId: createdUser.tenantId,
        }
      }).catch(() => {});

      return createdUser;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Cet e-mail ou nom d'utilisateur est déjà utilisé.`);
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(`Le département spécifié n'existe pas.`);
      }
      throw error;
    }
  }

  async updateRole(id: string, role: Role, currentUser?: any): Promise<User> {
    const oldUser = await this.prisma.user.findUnique({ where: { id } });
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'MODIFICATION_ROLE',
        entityType: 'USER',
        entityId: id,
        oldData: { role: oldUser?.role },
        newData: { role: updatedUser.role },
        performedBy: currentUser?.email || 'Système',
        tenantId: updatedUser.tenantId,
      }
    }).catch(() => {});

    return updatedUser;
  }

  async resetMfa(id: string, currentUser?: any): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable`);
    }
    
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'RESET_MFA',
        entityType: 'USER',
        entityId: id,
        newData: { mfaEnabled: false },
        performedBy: currentUser?.email || 'Système',
        tenantId: updatedUser.tenantId,
      }
    }).catch(() => {});

    return updatedUser;
  }

  async update(id: string, data: any, currentUser?: any): Promise<User> {
    const { id: dataId, ...prismaData } = data;
    if (prismaData.email?.toLowerCase().trim() === 'admin@entreprise.com') {
      throw new BadRequestException(
        'Cette adresse email est réservée par le système et ne peut pas être utilisée pour un utilisateur de tenant.',
      );
    }

    if (prismaData.password) {
      prismaData.password = await bcrypt.hash(prismaData.password, 12);
    }

    try {
      const oldUser = await this.prisma.user.findUnique({ where: { id } });
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: prismaData,
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'MODIFICATION',
          entityType: 'USER',
          entityId: id,
          oldData: oldUser ? { email: oldUser.email, firstName: oldUser.firstName, lastName: oldUser.lastName, role: oldUser.role } : undefined,
          newData: { email: updatedUser.email, firstName: updatedUser.firstName, lastName: updatedUser.lastName, role: updatedUser.role },
          performedBy: currentUser?.email || 'Système',
          tenantId: updatedUser.tenantId,
        }
      }).catch(() => {});

      return updatedUser;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Cet e-mail ou nom d'utilisateur est déjà utilisé.`);
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(`Le département spécifié n'existe pas.`);
      }
      throw error;
    }
  }

  async remove(id: string, currentUser?: any): Promise<User> {
    try {
      const userToDelete = await this.prisma.user.findUnique({ where: { id } });

      // 1. Dissocier les équipements assignés à l'utilisateur
      await this.prisma.asset.updateMany({
        where: { userId: id },
        data: { userId: null, status: 'IN_STOCK', assignmentDate: null },
      });

      // 2. Dissocier les tickets assignés à cet utilisateur
      await this.prisma.ticket.updateMany({
        where: { assigneeId: id },
        data: { assigneeId: null },
      });

      // 3. Trouver les tickets créés par cet utilisateur pour supprimer d'abord leurs commentaires
      const createdTickets = await this.prisma.ticket.findMany({
        where: { creatorId: id },
        select: { id: true },
      });
      const createdTicketIds = createdTickets.map(t => t.id);

      if (createdTicketIds.length > 0) {
        await this.prisma.ticketComment.deleteMany({
          where: { ticketId: { in: createdTicketIds } },
        });
        
        // Supprimer les tickets créés par cet utilisateur
        await this.prisma.ticket.deleteMany({
          where: { creatorId: id },
        });
      }

      // 4. Supprimer l'utilisateur de la base de données
      const deletedUser = await this.prisma.user.delete({
        where: { id },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'SUPPRESSION',
          entityType: 'USER',
          entityId: id,
          oldData: userToDelete ? { email: userToDelete.email, firstName: userToDelete.firstName, lastName: userToDelete.lastName, role: userToDelete.role } : undefined,
          performedBy: currentUser?.email || 'Système',
          tenantId: deletedUser.tenantId,
        }
      }).catch(() => {});

      return deletedUser;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Utilisateur introuvable.`);
      }
      throw error;
    }
  }
}
