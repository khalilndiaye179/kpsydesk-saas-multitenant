import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { Asset, AssetStatus } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Asset[]> {
    return this.prisma.asset.findMany({
      include: {
        user: true,
        location: true,
      },
    });
  }

  async findAllForUser(userId: string): Promise<Asset[]> {
    return this.prisma.asset.findMany({
      where: { userId },
      include: {
        user: true,
        location: true,
      },
    });
  }

  async findOne(id: string): Promise<Asset> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        user: true,
        location: true,
        histories: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(`Actif avec l'ID ${id} introuvable`);
    }
    return asset;
  }

  async create(data: any): Promise<Asset> {
    const { performedBy, ...prismaData } = data;
    try {
      return await this.prisma.asset.create({
        data: prismaData,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Ce code inventaire ou numéro de série est déjà utilisé.`);
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(`L'utilisateur ou l'emplacement spécifié n'existe pas.`);
      }
      throw error;
    }
  }

  async update(id: string, data: any): Promise<Asset> {
    const { performedBy, id: dataId, ...prismaData } = data;
    const oldAsset = await this.findOne(id);

    if (prismaData.status && prismaData.status !== oldAsset.status) {
      await this.prisma.assetHistory.create({
        data: {
          assetId: id,
          actionType: 'STATUS_CHANGE',
          oldValue: oldAsset.status,
          newValue: prismaData.status,
          reason: 'Modification équipement',
          changedBy: performedBy || 'admin',
        },
      });
    }

    try {
      return await this.prisma.asset.update({
        where: { id },
        data: prismaData,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Ce code inventaire ou numéro de série est déjà utilisé.`);
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(`L'utilisateur ou l'emplacement spécifié n'existe pas.`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Asset> {
    try {
      // 1. Supprimer l'historique lié à cet équipement
      await this.prisma.assetHistory.deleteMany({
        where: { assetId: id },
      });

      // 2. Dissocier les tickets qui font référence à cet équipement
      await this.prisma.ticket.updateMany({
        where: { assetId: id },
        data: { assetId: null },
      });

      // 3. Supprimer l'équipement de la base de données
      return await this.prisma.asset.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Équipement introuvable.`);
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: AssetStatus, reason?: string, changedBy?: string): Promise<Asset> {
    const asset = await this.findOne(id);
    
    // Enregistrement de l'historique de mouvement
    await this.prisma.assetHistory.create({
      data: {
        assetId: id,
        actionType: 'STATUS_CHANGE',
        oldValue: asset.status,
        newValue: status,
        reason: reason || 'Changement manuel',
        changedBy: changedBy || 'system',
      },
    });

    return this.prisma.asset.update({
      where: { id },
      data: { status },
    });
  }

  async enroll(data: any): Promise<Asset> {
    const {
      serialNumber,
      name, // hostname
      os,
      cpu,
      ram,
      storage,
      ipAddress,
      macAddress,
      model,
      manufacturer,
    } = data;

    if (!serialNumber && !macAddress) {
      throw new BadRequestException("L'adresse MAC ou le numéro de série est requis pour l'enrôlement.");
    }

    // 1. Recherche de l'équipement
    let asset = null;
    const invalidSerials = ['inconnu', 'unknown', 'n/a', 'system serial number', 'to be filled by o.e.m.', 'to be filled by oem', 'default string', '0123456789', '0000000000', ''];
    const isValidSerial = serialNumber && !invalidSerials.includes(serialNumber.toLowerCase().trim());

    // Récupérer le tenantId depuis le contexte ALS (posé par TenantMiddleware).
    // Un agent sans contexte tenant (appel sans X-Tenant-ID/subdomain) ne peut pas
    // trouver ni modifier d'équipement existant → il créera toujours un nouvel actif.
    const tenantId = TenantContext.getTenantId();

    if (isValidSerial) {
      asset = await this.prisma.asset.findFirst({
        where: {
          serialNumber: {
            equals: serialNumber.trim(),
            mode: 'insensitive'
          },
          // ⚠️ Filtre tenant : empêche de trouver un équipement appartenant à un autre tenant
          ...(tenantId ? { tenantId } : {}),
        }
      });
    }

    // 2. Si pas trouvé par numéro de série, recherche par adresse MAC (si valide)
    if (!asset && macAddress && macAddress !== '00:00:00:00:00:00' && macAddress.trim() !== '') {
      asset = await this.prisma.asset.findFirst({
        where: {
          macAddress: {
            equals: macAddress.trim(),
            mode: 'insensitive'
          },
          // ⚠️ Filtre tenant : empêche de trouver un équipement appartenant à un autre tenant
          ...(tenantId ? { tenantId } : {}),
        }
      });
    }

    const agentData = {
      cpu,
      ram,
      storage,
      os,
      ipAddress,
      macAddress,
      model,
      manufacturer,
      lastAgentCommunication: new Date(),
    };

    if (asset) {
      const oldStatus = asset.status;
      const oldName = asset.name;
      const updatedStatus = oldStatus === 'IN_STOCK' ? 'ASSIGNED' : oldStatus;

      const updatedAsset = await this.prisma.asset.update({
        where: { id: asset.id },
        data: {
          name: name || oldName,
          status: updatedStatus,
          ...agentData
        }
      });

      if (updatedStatus !== oldStatus) {
        await this.prisma.assetHistory.create({
          data: {
            assetId: asset.id,
            actionType: 'STATUS_CHANGE',
            oldValue: oldStatus,
            newValue: updatedStatus,
            reason: "Enrôlement automatique par l'agent",
            changedBy: 'Agent Windows',
          }
        });
      }

      await this.prisma.auditLog.create({
        data: {
          action: 'MODIFICATION',
          entityType: 'Asset',
          entityId: asset.id,
          performedBy: 'Agent Windows',
          oldData: asset as any,
          newData: updatedAsset as any,
        }
      });

      return updatedAsset;
    } else {
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const inventoryCode = `INV-AGT-${randomDigits}`;

      const newAsset = await this.prisma.asset.create({
        data: {
          inventoryCode,
          serialNumber: serialNumber || 'Inconnu',
          name: name || `PC-${serialNumber || 'Inconnu'}`,
          type: 'Ordinateur Portable',
          status: 'ASSIGNED',
          ...agentData
        }
      });

      await this.prisma.assetHistory.create({
        data: {
          assetId: newAsset.id,
          actionType: 'STATUS_CHANGE',
          oldValue: 'N/A',
          newValue: 'ASSIGNED',
          reason: "Enrôlement automatique initial par l'agent",
          changedBy: 'Agent Windows',
        }
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'AJOUT',
          entityType: 'Asset',
          entityId: newAsset.id,
          performedBy: 'Agent Windows',
          newData: newAsset as any,
        }
      });

      return newAsset;
    }
  }
}
