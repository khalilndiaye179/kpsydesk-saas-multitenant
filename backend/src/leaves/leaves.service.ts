import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveRequest } from '@prisma/client';

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<LeaveRequest[]> {
    return this.prisma.leaveRequest.findMany({
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, position: true }
        },
        validator: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findAllForUser(userId: string): Promise<LeaveRequest[]> {
    return this.prisma.leaveRequest.findMany({
      where: { userId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, position: true }
        },
        validator: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string): Promise<LeaveRequest> {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true }
        },
        validator: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    });
    if (!request) {
      throw new NotFoundException(`Demande de congé #${id} introuvable.`);
    }
    return request;
  }

  async create(userId: string, data: { type: string; startDate: string; endDate: string; reason?: string }): Promise<LeaveRequest> {
    return this.prisma.leaveRequest.create({
      data: {
        userId,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        status: 'PENDING'
      }
    });
  }

  async updateStatus(id: string, validatorId: string, status: string, rejectionReason?: string): Promise<LeaveRequest> {
    const request = await this.findOne(id);
    if (request.status !== 'PENDING') {
      throw new ForbiddenException(`Cette demande de congé a déjà été traitée.`);
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        validatorId,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null
      }
    });
  }
}
