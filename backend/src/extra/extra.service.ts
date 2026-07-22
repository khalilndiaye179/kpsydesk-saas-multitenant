import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExtraService {
  constructor(private prisma: PrismaService) {}

  private getDelegate(entity: string) {
    switch (entity.toLowerCase()) {
      case 'licenses':
        return this.prisma.license;
      case 'departments':
        return this.prisma.department;
      case 'onboardings':
        return this.prisma.onboarding;
      case 'maintenances':
        return this.prisma.maintenance;
      case 'locations':
        return this.prisma.location;
      case 'consumables':
        return this.prisma.consumable;
      case 'suppliers':
        return this.prisma.supplier;
      case 'orders':
        return this.prisma.purchaseOrder;
      case 'contracts':
        return this.prisma.contract;
      case 'sales':
        return this.prisma.sale;
      case 'kb':
        return this.prisma.kBArticle;
      case 'audit-logs':
        return this.prisma.auditLog;
      case 'movements':
        return this.prisma.movement;
      case 'depreciations':
        return (this.prisma as any).depreciation;
      default:
        throw new NotFoundException(`Entité non supportée: ${entity}`);
    }
  }

  async findAll(entity: string) {
    const delegate = this.getDelegate(entity);
    if (entity.toLowerCase() === 'orders') {
      return (delegate as any).findMany({
        include: { supplier: true },
        orderBy: { date: 'desc' }
      });
    }
    if (entity.toLowerCase() === 'contracts') {
      return (delegate as any).findMany({
        include: { supplier: true }
      });
    }
    if (entity.toLowerCase() === 'movements') {
      return (delegate as any).findMany({
        orderBy: { date: 'desc' }
      });
    }
    if (entity.toLowerCase() === 'audit-logs') {
      return (delegate as any).findMany({
        orderBy: { createdAt: 'desc' }
      });
    }
    return (delegate as any).findMany();
  }

  async findOne(entity: string, id: string) {
    const delegate = this.getDelegate(entity);
    const item = await (delegate as any).findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Élément introuvable dans ${entity}`);
    }
    return item;
  }

  async create(entity: string, data: any) {
    const delegate = this.getDelegate(entity);
    const formattedData = this.formatDates(entity, data);
    
    // Extract performedBy
    const { performedBy, ...prismaData } = formattedData;
    if (entity.toLowerCase() === 'movements' || entity.toLowerCase() === 'audit-logs') {
      if (performedBy !== undefined) {
        (prismaData as any).performedBy = performedBy;
      }
    }
    
    try {
      const created = await (delegate as any).create({ data: prismaData });

      if (entity !== 'audit-logs') {
        await this.logAudit('CREATION', entity, created.id, null, created, performedBy);
      }
      
      return created;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Cet élément (référence ou nom unique) existe déjà.`);
      }
      throw error;
    }
  }

  async update(entity: string, id: string, data: any) {
    const delegate = this.getDelegate(entity);
    const old = await this.findOne(entity, id);
    const formattedData = this.formatDates(entity, data);
    
    const { performedBy, ...prismaData } = formattedData;
    if (entity.toLowerCase() === 'movements' || entity.toLowerCase() === 'audit-logs') {
      if (performedBy !== undefined) {
        (prismaData as any).performedBy = performedBy;
      }
    }

    try {
      const updated = await (delegate as any).update({
        where: { id },
        data: prismaData
      });

      if (entity !== 'audit-logs') {
        await this.logAudit('MODIFICATION', entity, id, old, updated, performedBy);
      }

      return updated;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Cet élément (référence ou nom unique) existe déjà.`);
      }
      throw error;
    }
  }

  async remove(entity: string, id: string, performedBy?: string) {
    const delegate = this.getDelegate(entity);
    const old = await this.findOne(entity, id);
    
    try {
      await (delegate as any).delete({ where: { id } });

      if (entity !== 'audit-logs') {
        await this.logAudit('SUPPRESSION', entity, id, old, null, performedBy);
      }

      return old;
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new ConflictException(`Impossible de supprimer cet élément car il est référencé par d'autres données.`);
      }
      if (error.code === 'P2025') {
        throw new NotFoundException(`Élément introuvable.`);
      }
      throw error;
    }
  }

  async clearAuditLogs() {
    throw new BadRequestException("Accès refusé : Le journal d'audit est inaltérable et ne peut pas être vidé.");
  }

  private formatDates(entity: string, data: any): any {
    const copy = { ...data };
    delete copy.id;

    const dateFields: Record<string, string[]> = {
      licenses: ['expireDate'],
      onboardings: ['startDate'],
      maintenances: ['date'],
      orders: ['date'],
      contracts: ['startDate', 'endDate'],
      sales: ['date'],
      movements: ['date'],
      depreciations: ['purchaseDate'],
    };

    const fields = dateFields[entity.toLowerCase()];
    if (fields) {
      fields.forEach(field => {
        if (copy[field]) {
          copy[field] = new Date(copy[field]);
        }
      });
    }

    if (copy.amount !== undefined && copy.amount !== null) copy.amount = parseFloat(copy.amount);
    if (copy.cost !== undefined && copy.cost !== null) copy.cost = parseFloat(copy.cost);
    if (copy.seats !== undefined && copy.seats !== null) copy.seats = parseInt(copy.seats, 10);
    if (copy.used !== undefined && copy.used !== null) copy.used = parseInt(copy.used, 10);
    if (copy.quantity !== undefined && copy.quantity !== null) copy.quantity = parseInt(copy.quantity, 10);
    if (copy.alertThreshold !== undefined && copy.alertThreshold !== null) copy.alertThreshold = parseInt(copy.alertThreshold, 10);
    if (copy.purchasePrice !== undefined && copy.purchasePrice !== null) copy.purchasePrice = parseFloat(copy.purchasePrice);
    if (copy.sellingPrice !== undefined && copy.sellingPrice !== null) copy.sellingPrice = parseFloat(copy.sellingPrice);

    return copy;
  }

  private async logAudit(action: string, entityType: string, entityId: string, oldData: any, newData: any, performedBy?: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType,
          entityId,
          oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : undefined,
          newData: newData ? JSON.parse(JSON.stringify(newData)) : undefined,
          performedBy: performedBy || 'Système'
        }
      });
    } catch (e) {
      console.error('Erreur écriture audit log:', e);
    }
  }
}
