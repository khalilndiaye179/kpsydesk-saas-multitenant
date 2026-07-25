import { Test, TestingModule } from '@nestjs/testing';
import { TenantInvoicesService } from '../tenant-invoices/tenant-invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('🧾 Facturation DGI Tenant (Livrable B) — Suite de Tests', () => {
  let service: TenantInvoicesService;
  let prisma: PrismaService;

  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantInvoicesService,
        PrismaService,
      ],
    }).compile();

    service = module.get<TenantInvoicesService>(TenantInvoicesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Plans & Tenants
    const plan = await prisma.plan.findFirst();
    const planId = plan?.id;

    const tenantA = await prisma.tenant.create({
      data: { name: 'Tenant Invoice A', subdomain: 'tenant-a-inv', status: 'ACTIVE', planId }
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: { name: 'Tenant Invoice B', subdomain: 'tenant-b-inv', status: 'ACTIVE', planId }
    });
    tenantBId = tenantB.id;
  });

  afterAll(async () => {
    // Teardown
    await prisma.tenantInvoiceItem.deleteMany({});
    await prisma.tenantInvoice.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await prisma.tenantInvoiceSequence.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } }
    });
  });

  beforeEach(async () => {
    // Nettoyer les factures de test avant chaque test
    await prisma.tenantInvoiceItem.deleteMany({});
    await prisma.tenantInvoice.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await prisma.tenantInvoiceSequence.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
  });

  it('🟢 Test 1 : Concurrence - Déclenchement de 10 créations simultanées sans doublon de séquence', async () => {
    const invoiceDto = {
      clientName: 'Client Test',
      clientEmail: 'client@test.com',
      tvaRate: 18,
      items: [
        { description: 'Service A', quantity: 2, unitPrice: 50000 },
        { description: 'Service B', quantity: 1, unitPrice: 100000 }
      ]
    };

    // Lancer 10 créations en parallèle
    const promises = Array.from({ length: 10 }).map(() =>
      service.create(tenantAId, invoiceDto)
    );

    const results = await Promise.all(promises);

    // Vérifier les numéros de facture
    const numbers = results.map(r => r.invoiceNo);
    expect(numbers.length).toBe(10);

    // L'ensemble doit contenir 10 numéros uniques
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(10);

    // Vérifier le format de la séquence (FAC-YYYY-NNNN)
    const currentYear = new Date().getFullYear();
    for (let i = 1; i <= 10; i++) {
      const expectedNo = `FAC-${currentYear}-${String(i).padStart(4, '0')}`;
      expect(numbers).toContain(expectedNo);
    }
  });

  it('🟢 Test 2 : Règle d\'Intégrité - Impossible de supprimer une facture non brouillon (DRAFT)', async () => {
    const invoice = await service.create(tenantAId, {
      clientName: 'Client A',
      tvaRate: 18,
      items: [{ description: 'Matériel', quantity: 1, unitPrice: 150000 }]
    });

    // 1. Suppression brouillon autorisée
    await expect(service.remove(invoice.id, tenantAId)).resolves.toBeDefined();

    // 2. Créer une nouvelle facture et la passer à ISSUED
    const invoice2 = await service.create(tenantAId, {
      clientName: 'Client A',
      tvaRate: 18,
      items: [{ description: 'Matériel', quantity: 1, unitPrice: 150000 }]
    });

    await service.updateStatus(invoice2.id, tenantAId, 'ISSUED');

    // 3. Suppression bloquée
    await expect(service.remove(invoice2.id, tenantAId)).rejects.toThrow(BadRequestException);
  });

  it('🔒 Test 3 : Isolation Inter-Tenant - Les factures sont cloisonnées par tenantId', async () => {
    // Créer une facture pour le Tenant A
    const invoiceA = await service.create(tenantAId, {
      clientName: 'Client Tenant A',
      tvaRate: 18,
      items: [{ description: 'Audit', quantity: 1, unitPrice: 200000 }]
    });

    // 1. Tenter d'accéder à la facture de A depuis B
    await expect(service.findOne(invoiceA.id, tenantBId)).rejects.toThrow();

    // 2. Tenter de modifier le statut de A depuis B
    await expect(service.updateStatus(invoiceA.id, tenantBId, 'PAID')).rejects.toThrow();

    // 3. Tenter de supprimer A depuis B
    await expect(service.remove(invoiceA.id, tenantBId)).rejects.toThrow();
  });
});
