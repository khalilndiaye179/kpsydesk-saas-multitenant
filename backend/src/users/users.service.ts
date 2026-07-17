import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Role } from '@prisma/client';

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

  async create(data: any): Promise<User> {
    if (data.email?.toLowerCase().trim() === 'admin@entreprise.com') {
      throw new BadRequestException(
        'Cette adresse email est réservée par le système et ne peut pas être utilisée pour un utilisateur de tenant.',
      );
    }

    try {
      return await this.prisma.user.create({
        data,
      });
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

  async updateRole(id: string, role: Role): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  async update(id: string, data: any): Promise<User> {
    const { id: dataId, ...prismaData } = data;
    if (prismaData.email?.toLowerCase().trim() === 'admin@entreprise.com') {
      throw new BadRequestException(
        'Cette adresse email est réservée par le système et ne peut pas être utilisée pour un utilisateur de tenant.',
      );
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data: prismaData,
      });
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

  async remove(id: string): Promise<User> {
    try {
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
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Utilisateur introuvable.`);
      }
      throw error;
    }
  }
}
