import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('🔒 Performance Support & SLA — Tests de sécurité et calculs', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantAId: string;
  let tenantBId: string;
  let tenantAToken: string;
  let tenantBToken: string;
  let techAToken: string;
  let techBToken: string;
  let techAId: string;
  let techBId: string;

  beforeAll(async () => {
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // 1. Créer les tenants
    const plan = await prisma.plan.findFirst({ where: { name: 'Starter' } });
    const planId = plan?.id;

    const tenantA = await prisma.tenant.create({
      data: { name: 'Tenant Perf A', subdomain: 'tenant-a-perf', status: 'ACTIVE', planId }
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: { name: 'Tenant Perf B', subdomain: 'tenant-b-perf', status: 'ACTIVE', planId }
    });
    tenantBId = tenantB.id;

    // 2. Créer les admins
    const hash = await bcrypt.hash('Test@1234', 12);
    const adminA = await prisma.user.create({
      data: {
        email: 'admin@tenant-a-perf.com',
        firstName: 'Admin',
        lastName: 'A',
        password: hash,
        role: 'ADMIN',
        tenantId: tenantAId
      }
    });
    const adminB = await prisma.user.create({
      data: {
        email: 'admin@tenant-b-perf.com',
        firstName: 'Admin',
        lastName: 'B',
        password: hash,
        role: 'ADMIN',
        tenantId: tenantBId
      }
    });

    // 3. Créer les techniciens
    const techA = await prisma.user.create({
      data: {
        email: 'tech@tenant-a-perf.com',
        firstName: 'Tech',
        lastName: 'A',
        password: hash,
        role: 'TECHNICIAN',
        tenantId: tenantAId
      }
    });
    techAId = techA.id;

    const techB = await prisma.user.create({
      data: {
        email: 'tech@tenant-b-perf.com',
        firstName: 'Tech',
        lastName: 'B',
        password: hash,
        role: 'TECHNICIAN',
        tenantId: tenantBId
      }
    });
    techBId = techB.id;

    // Signer les tokens
    tenantAToken = jwtService.sign({ sub: adminA.id, email: adminA.email, role: adminA.role, tenantId: tenantAId });
    tenantBToken = jwtService.sign({ sub: adminB.id, email: adminB.email, role: adminB.role, tenantId: tenantBId });
    techAToken = jwtService.sign({ sub: techA.id, email: techA.email, role: techA.role, tenantId: tenantAId });
    techBToken = jwtService.sign({ sub: techB.id, email: techB.email, role: techB.role, tenantId: tenantBId });

    // Nettoyer les tickets pour éviter les interférences
    await prisma.ticket.deleteMany({});

    // 4. Créer des tickets de test
    // Ticket 1 : Tenant A, Assigné à Tech A, Créé il y a 5 heures, Résolu il y a 1 heure (Temps = 4 heures).
    // Priorité HIGH -> Limite SLA = 3 heures. Donc SLA Dépassé.
    const date5hAgo = new Date();
    date5hAgo.setHours(date5hAgo.getHours() - 5);
    const date1hAgo = new Date();
    date1hAgo.setHours(date1hAgo.getHours() - 1);
    
    await prisma.ticket.create({
      data: {
        title: 'Ticket Test 1',
        description: 'SLA Dépassé',
        status: 'RESOLVED',
        priority: 'HIGH',
        creatorId: adminA.id,
        assigneeId: techAId,
        tenantId: tenantAId,
        createdAt: date5hAgo,
        resolvedAt: date1hAgo
      }
    });

    // Ticket 2 : Tenant A, Assigné à Tech A, Créé il y a 2 heures, Résolu il y a 1 heure (Temps = 1 heure).
    // Priorité HIGH -> Limite SLA = 3 heures. Donc SLA Respecté.
    const date2hAgo = new Date();
    date2hAgo.setHours(date2hAgo.getHours() - 2);

    await prisma.ticket.create({
      data: {
        title: 'Ticket Test 2',
        description: 'SLA Respecté',
        status: 'RESOLVED',
        priority: 'HIGH',
        creatorId: adminA.id,
        assigneeId: techAId,
        tenantId: tenantAId,
        createdAt: date2hAgo,
        resolvedAt: date1hAgo
      }
    });

    // Ticket 3 : Tenant A, Assigné à Tech A, Ouvert (sans date de résolution)
    await prisma.ticket.create({
      data: {
        title: 'Ticket Test 3',
        description: 'Ouvert',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        creatorId: adminA.id,
        assigneeId: techAId,
        tenantId: tenantAId,
        createdAt: new Date()
      }
    });

    // Ticket 4 : Tenant A, Assigné à Tech A, créé il y a 15 jours (pour tester les filtres de période)
    const date15dAgo = new Date();
    date15dAgo.setDate(date15dAgo.getDate() - 15);
    const date14dAgo = new Date();
    date14dAgo.setDate(date14dAgo.getDate() - 14);

    await prisma.ticket.create({
      data: {
        title: 'Ticket Test Ancien',
        description: 'Ancien résolu',
        status: 'RESOLVED',
        priority: 'CRITICAL', // SLA limit = 1.5h
        creatorId: adminA.id,
        assigneeId: techAId,
        tenantId: tenantAId,
        createdAt: date15dAgo,
        resolvedAt: date14dAgo // 24h de résolution -> SLA Dépassé
      }
    });

    // Ticket 5 : Tenant B, Assigné à Tech B, Résolu.
    await prisma.ticket.create({
      data: {
        title: 'Ticket Tenant B',
        description: 'Autre tenant',
        status: 'RESOLVED',
        priority: 'LOW',
        creatorId: adminB.id,
        assigneeId: techBId,
        tenantId: tenantBId,
        createdAt: new Date()
      }
    });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@tenant-a-perf.com', 'admin@tenant-b-perf.com', 'tech@tenant-a-perf.com', 'tech@tenant-b-perf.com'] } }
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } }
    });
    await app.close();
  });

  it('🟢 Test 1 : Un admin de Tenant A ne voit que les performances de son équipe', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tenants/me/support-performance')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .set('X-Tenant-ID', 'tenant-a-perf');

    expect(res.status).toBe(200);
    // Doit lister les techniciens de Tenant A (Tech A, Admin A qui est aussi candidat)
    expect(res.body.some((p: any) => p.name === 'Tech A')).toBe(true);
    // Ne doit PAS lister le technicien de Tenant B
    expect(res.body.some((p: any) => p.name === 'Tech B')).toBe(false);
  });

  it('🔴 Test 2 : Un admin de Tenant A ne peut pas accéder aux performances d\'un autre tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tenants/me/support-performance')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .set('X-Tenant-ID', 'tenant-b-perf'); // Tente de forcer l'entête sur Tenant B

    expect(res.status).toBe(403); // Bloqué par TenantGuard!
  });

  it('🟢 Test 3 : Calcul du temps moyen de résolution et SLA pour un technicien', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tenants/me/support-performance')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .set('X-Tenant-ID', 'tenant-a-perf');

    expect(res.status).toBe(200);
    const techRow = res.body.find((p: any) => p.id === techAId);
    expect(techRow).toBeDefined();
    
    // Avec la période par défaut de 30 jours, les tickets résolus récents pour Tech A sont :
    // Ticket 1 (4h, SLA Dépassé) et Ticket 2 (1h, SLA Respecté) et Ticket Ancien (24h, SLA Dépassé)
    // Total résolus = 3.
    // Temps moyen de résolution = (4 + 1 + 24) / 3 = 29 / 3 = 9.7 heures.
    expect(techRow.resolvedTickets).toBe(3);
    expect(techRow.avgResolutionTime).toBeCloseTo(9.7, 1);
    
    // SLA Taux de respect : 1 sur 3 est respecté (Ticket 2).
    // Donc 33%
    expect(techRow.slaRate).toBe(33);
  });

  it('🟢 Test 4 : Changement de période (ex: 7j vs 30j)', async () => {
    // Si on interroge sur 7j :
    // Les tickets résolus de moins de 7 jours pour Tech A sont : Ticket 1 (4h, SLA Dépassé) et Ticket 2 (1h, SLA Respecté).
    // Total résolus = 2.
    // Temps moyen de résolution = (4 + 1) / 2 = 2.5 heures.
    // SLA Taux de respect : 1 sur 2 est respecté (Ticket 2). Donc 50%.
    const res = await request(app.getHttpServer())
      .get('/api/tenants/me/support-performance?period=7j')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .set('X-Tenant-ID', 'tenant-a-perf');

    expect(res.status).toBe(200);
    const techRow = res.body.find((p: any) => p.id === techAId);
    expect(techRow).toBeDefined();
    expect(techRow.resolvedTickets).toBe(2);
    expect(techRow.avgResolutionTime).toBe(2.5);
    expect(techRow.slaRate).toBe(50);
  });

  it('🔒 Test 5 : Un technicien ne voit que ses propres statistiques d\'audience', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tenants/me/support-performance')
      .set('Authorization', `Bearer ${techAToken}`)
      .set('X-Tenant-ID', 'tenant-a-perf');

    expect(res.status).toBe(200);
    // Le tableau ne contient qu'une seule ligne correspondant à lui-même
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(techAId);
  });
});
