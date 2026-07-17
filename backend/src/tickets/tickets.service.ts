import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Ticket } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

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

      return await this.prisma.ticket.create({
        data: {
          ...data,
          creatorId: creatorId,
          status: 'OPEN',
        },
      });
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
      return await this.prisma.ticket.update({
        where: { id },
        data: prismaData,
      });
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
    return this.prisma.ticket.update({
      where: { id },
      data: { 
        assigneeId,
        status: 'IN_PROGRESS'
      },
    });
  }
}
