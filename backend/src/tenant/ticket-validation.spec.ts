import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from '../tickets/tickets.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('🎟️ Validation de Tickets à 2 Niveaux — Suite de Tests', () => {
  let service: TicketsService;
  let mailService: MailService;
  let prisma: PrismaService;

  let tenantId: string;
  let creatorId: string;
  let otherUserId: string;
  let techId: string;
  let adminUser: any;
  let techUser: any;
  let creatorUser: any;
  let otherUser: any;

  beforeAll(async () => {
    const mockMailService = {
      sendMail: jest.fn().mockResolvedValue(true)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        PrismaService,
        { provide: MailService, useValue: mockMailService }
      ]
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    mailService = module.get<MailService>(MailService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Tenant & Users
    const plan = await prisma.plan.findFirst();
    const tenant = await prisma.tenant.create({
      data: { name: 'Tenant Ticket Validation', subdomain: 'tenant-t-val', status: 'ACTIVE', planId: plan?.id }
    });
    tenantId = tenant.id;

    const creator = await prisma.user.create({
      data: { email: 'creator@t-val.com', firstName: 'Creator', lastName: 'User', password: 'password', role: 'USER', tenantId }
    });
    creatorId = creator.id;
    creatorUser = { userId: creatorId, email: creator.email, role: 'USER', tenantId };

    const other = await prisma.user.create({
      data: { email: 'other@t-val.com', firstName: 'Other', lastName: 'User', password: 'password', role: 'USER', tenantId }
    });
    otherUserId = other.id;
    otherUser = { userId: otherUserId, email: other.email, role: 'USER', tenantId };

    const tech = await prisma.user.create({
      data: { email: 'tech@t-val.com', firstName: 'Tech', lastName: 'Support', password: 'password', role: 'TECHNICIAN', tenantId }
    });
    techId = tech.id;
    techUser = { userId: techId, email: tech.email, role: 'TECHNICIAN', tenantId };

    adminUser = { userId: 'admin-id', email: 'admin@t-val.com', role: 'ADMIN', tenantId };
  });

  afterAll(async () => {
    // Teardown
    await prisma.ticketComment.deleteMany({});
    await prisma.ticket.deleteMany({
      where: { tenantId }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['creator@t-val.com', 'other@t-val.com', 'tech@t-val.com'] } }
    });
    await prisma.tenant.deleteMany({
      where: { id: tenantId }
    });
  });

  beforeEach(async () => {
    await prisma.ticketComment.deleteMany({});
    await prisma.ticket.deleteMany({
      where: { tenantId }
    });
    jest.clearAllMocks();
  });

  it('🟢 Test 1 : Technicien résout -> passe en PENDING_RESOLVED & envoie un e-mail au créateur', async () => {
    // Créer un ticket ouvert
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Ticket Test',
        description: 'Panne HP Officejet',
        status: 'OPEN',
        priority: 'MEDIUM',
        creatorId,
        tenantId
      }
    });

    const sendMailSpy = jest.spyOn(mailService, 'sendMail');

    // Technicien met à jour le statut vers RESOLVED (intercepté en PENDING_RESOLVED)
    const updated = await service.updateStatus(ticket.id, 'RESOLVED', techUser);

    expect(updated.status).toBe('PENDING_RESOLVED');
    expect(updated.resolvedAt).toBeDefined(); // La date de résolution est enregistrée pour les SLAs du technicien
    expect(sendMailSpy).toHaveBeenCalled();
    expect(sendMailSpy.mock.calls[0][0]).toBe('creator@t-val.com');
    expect(sendMailSpy.mock.calls[0][1]).toContain('Votre ticket est résolu');
  });

  it('🟢 Test 2 : Droits créateur - Seul le créateur du ticket peut confirmer sa résolution', async () => {
    // Créer un ticket résolu par le support (en attente de confirmation)
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Ticket Test 2',
        description: 'Description 2',
        status: 'PENDING_RESOLVED',
        priority: 'MEDIUM',
        creatorId,
        tenantId
      }
    });

    // 1. Un autre utilisateur (USER) tente de confirmer -> rejeté
    await expect(service.confirmResolution(ticket.id, otherUser)).rejects.toThrow(ForbiddenException);

    // 2. Le créateur confirme -> succès et passe à RESOLUTION_CONFIRMED
    const confirmed = await service.confirmResolution(ticket.id, creatorUser);
    expect(confirmed.status).toBe('RESOLUTION_CONFIRMED');
  });

  it('🟢 Test 3 : Refus de résolution - Repasse en IN_PROGRESS avec commentaire obligatoire', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Ticket Test 3',
        description: 'Description 3',
        status: 'PENDING_RESOLVED',
        priority: 'MEDIUM',
        creatorId,
        tenantId,
        resolvedAt: new Date()
      }
    });

    // 1. Refus sans commentaire -> rejeté
    await expect(service.rejectResolution(ticket.id, '', creatorUser)).rejects.toThrow(BadRequestException);

    // 2. Refus par un autre utilisateur -> rejeté
    await expect(service.rejectResolution(ticket.id, 'Non résolu', otherUser)).rejects.toThrow(ForbiddenException);

    // 3. Refus valide par le créateur
    const rejected = await service.rejectResolution(ticket.id, 'L\'imprimante fait toujours du bruit', creatorUser);
    
    expect(rejected.status).toBe('IN_PROGRESS');
    expect(rejected.resolvedAt).toBeNull(); // resolvedAt réinitialisé à null

    // Vérifier l'insertion du commentaire
    const comments = await prisma.ticketComment.findMany({
      where: { ticketId: ticket.id }
    });
    expect(comments.length).toBe(1);
    expect(comments[0].content).toBe('L\'imprimante fait toujours du bruit');
    expect(comments[0].authorId).toBe(creatorId);
  });

  it('🟢 Test 4 : Règle de clôture Admin & Rétrocompatibilité', async () => {
    // 1. Nouveau ticket créé aujourd'hui
    const newTicket = await prisma.ticket.create({
      data: {
        title: 'Nouveau Ticket',
        description: 'Desc',
        status: 'PENDING_RESOLVED',
        priority: 'MEDIUM',
        creatorId,
        tenantId,
        createdAt: new Date() // date courante
      }
    });

    // Admin tente de le clore directement depuis PENDING_RESOLVED -> Bloqué !
    await expect(service.updateStatus(newTicket.id, 'CLOSED', adminUser)).rejects.toThrow(BadRequestException);

    // 2. Ticket hérité (créé avant le déploiement)
    const legacyTicket = await prisma.ticket.create({
      data: {
        title: 'Ancien Ticket',
        description: 'Desc',
        status: 'PENDING_RESOLVED',
        priority: 'MEDIUM',
        creatorId,
        tenantId,
        createdAt: new Date('2026-07-24T00:00:00Z') // antérieur au 25 Juillet 2026 01:30
      }
    });

    // Admin tente de clore l'ancien ticket directement -> Autorisé pour rétrocompatibilité
    const closedLegacy = await service.updateStatus(legacyTicket.id, 'CLOSED', adminUser);
    expect(closedLegacy.status).toBe('CLOSED');
  });
});
