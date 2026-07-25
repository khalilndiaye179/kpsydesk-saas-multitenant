import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantInvoiceDto } from './dto/create-tenant-invoice.dto';

@Injectable()
export class TenantInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.tenantInvoice.findMany({
      where: { tenantId },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string, tenantId: string) {
    const invoice = await this.prisma.tenantInvoice.findFirst({
      where: { id, tenantId },
      include: { items: true, tenant: true }
    });

    if (!invoice) {
      throw new NotFoundException(`Facture avec l'ID ${id} introuvable.`);
    }

    return invoice;
  }

  async create(tenantId: string, data: CreateTenantInvoiceDto) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('La facture doit contenir au moins un article.');
    }

    const currentYear = new Date().getFullYear();

    return this.prisma.$transaction(async (tx) => {
      // 1. Lock and retrieve sequence (pessimistic SELECT FOR UPDATE)
      // On crée d'abord la ligne de séquence si elle n'existe pas
      await tx.tenantInvoiceSequence.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId, nextValue: 1, year: currentYear }
      });

      // On applique un verrou de ligne en lecture/écriture
      const seqRaw = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, "nextValue", "year" FROM "TenantInvoiceSequence" WHERE "tenantId" = $1 FOR UPDATE`,
        tenantId
      );

      const seq = seqRaw[0];
      let seqValue = seq.nextValue;
      let seqYear = seq.year;

      if (seqYear !== currentYear) {
        // Nouvelle année -> on réinitialise à 1
        seqValue = 1;
        seqYear = currentYear;
      }

      // Incrémenter et sauvegarder la séquence
      await tx.tenantInvoiceSequence.update({
        where: { id: seq.id },
        data: { nextValue: seqValue + 1, year: seqYear }
      });

      // Formater le numéro séquentiel (ex: FAC-2026-0001)
      const invoiceNo = `FAC-${seqYear}-${String(seqValue).padStart(4, '0')}`;

      // Calculer les montants
      const amountHT = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const tvaAmount = amountHT * (data.tvaRate / 100);
      const amountTTC = amountHT + tvaAmount;

      // 2. Créer la facture et ses lignes d'articles
      return tx.tenantInvoice.create({
        data: {
          invoiceNo,
          tenantId,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          clientPhone: data.clientPhone,
          clientNinea: data.clientNinea,
          clientRc: data.clientRc,
          amountHT,
          tvaRate: data.tvaRate,
          tvaAmount,
          amountTTC,
          status: 'DRAFT',
          notes: data.notes,
          items: {
            create: data.items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice
            }))
          }
        },
        include: {
          items: true
        }
      });
    });
  }

  async updateStatus(id: string, tenantId: string, status: string) {
    const invoice = await this.findOne(id, tenantId);

    const allowedStatuses = ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(`Statut de facture invalide.`);
    }

    return this.prisma.tenantInvoice.update({
      where: { id: invoice.id },
      data: { status },
      include: { items: true }
    });
  }

  async remove(id: string, tenantId: string) {
    const invoice = await this.findOne(id, tenantId);

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Seules les factures à l\'état de brouillon (DRAFT) peuvent être supprimées.');
    }

    // Supprimer les items associés d'abord
    await this.prisma.tenantInvoiceItem.deleteMany({
      where: { tenantInvoiceId: invoice.id }
    });

    return this.prisma.tenantInvoice.delete({
      where: { id: invoice.id }
    });
  }
}
