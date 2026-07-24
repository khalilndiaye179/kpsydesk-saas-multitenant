import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('🔒 Isolation & Rétention d\'Audience — Tests de sécurité', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantAId: string;
  let tenantBId: string;
  let tenantAToken: string;
  let tenantBToken: string;
  let superAdminToken: string;

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

    // 1. Créer les tenants de test
    const plan = await prisma.plan.findFirst({ where: { name: 'Starter' } });
    const planId = plan?.id;

    const tenantA = await prisma.tenant.create({
      data: { name: 'Tenant Analytics A', subdomain: 'tenant-a-ana', status: 'ACTIVE', planId }
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: { name: 'Tenant Analytics B', subdomain: 'tenant-b-ana', status: 'ACTIVE', planId }
    });
    tenantBId = tenantB.id;

    // 2. Créer les utilisateurs
    const hash = await bcrypt.hash('Test@1234', 12);
    const userA = await prisma.user.create({
      data: {
        email: 'admin@tenant-a-ana.com',
        firstName: 'Admin',
        lastName: 'A',
        password: hash,
        role: 'ADMIN',
        tenantId: tenantAId
      }
    });

    const userB = await prisma.user.create({
      data: {
        email: 'admin@tenant-b-ana.com',
        firstName: 'Admin',
        lastName: 'B',
        password: hash,
        role: 'ADMIN',
        tenantId: tenantBId
      }
    });

    const superAdmin = await prisma.user.create({
      data: {
        email: 'superadmin@kpsy.com',
        firstName: 'Super',
        lastName: 'Admin',
        password: hash,
        role: 'ADMIN',
        systemRole: 'Admin IT' // Super Admin global role
      }
    });

    // 3. Générer les tokens JWT
    tenantAToken = jwtService.sign({ sub: userA.id, email: userA.email, role: userA.role, tenantId: tenantAId });
    tenantBToken = jwtService.sign({ sub: userB.id, email: userB.email, role: userB.role, tenantId: tenantBId });
    superAdminToken = jwtService.sign({ sub: superAdmin.id, email: superAdmin.email, role: superAdmin.role, systemRole: 'Admin IT' });

    // 4. Nettoyer les anciennes PageViews pour éviter le bruit
    await prisma.pageView.deleteMany({});

    // 5. Créer des entrées PageView de test
    // Visite récente Tenant A (aujourd'hui)
    await prisma.pageView.create({
      data: {
        path: '/app/dashboard',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows)',
        tenantId: tenantAId,
        createdAt: new Date()
      }
    });

    // Visite ancienne Tenant A (plus de 90 jours)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 95);
    await prisma.pageView.create({
      data: {
        path: '/app/old-page',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows)',
        tenantId: tenantAId,
        createdAt: oldDate
      }
    });

    // Visite récente Tenant B (aujourd'hui)
    await prisma.pageView.create({
      data: {
        path: '/app/dashboard',
        ip: '192.168.1.2',
        userAgent: 'Mozilla/5.0 (Mac)',
        tenantId: tenantBId,
        createdAt: new Date()
      }
    });
  });

  afterAll(async () => {
    // Nettoyer les données de test
    await prisma.pageView.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@tenant-a-ana.com', 'admin@tenant-b-ana.com', 'superadmin@kpsy.com'] } }
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } }
    });
    await app.close();
  });

  it('🟢 Test 1 : Un admin de Tenant A ne voit que ses propres statistiques d\'audience', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tenants/me/analytics/stats')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .set('X-Tenant-ID', 'tenant-a-ana');

    expect(res.status).toBe(200);
    expect(res.body.pageViewsToday).toBe(1); // seulement l'entrée récente de Tenant A (l'ancienne n'est pas "Today")
    expect(res.body.uniqueVisitorsToday).toBe(1);
    expect(res.body.note).toBe('Estimation basée sur les adresses IP distinctes');
  });

  it('🔴 Test 2 : Un admin de Tenant A ne peut pas accéder aux statistiques globales Super-Admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin-tenants/analytics/stats')
      .set('Authorization', `Bearer ${tenantAToken}`);

    expect(res.status).toBe(403);
  });

  it('🟢 Test 3 : Le Super-Admin accède aux statistiques globales sans régression', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin-tenants/analytics/stats')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalPageViews).toBe(3); // toutes les entrées (2 récentes + 1 ancienne)
  });

  it('🟢 Test 4 : La tâche de purge supprime les entrées de plus de 90 jours et garde les récentes', async () => {
    // Vérifier avant la purge
    const countBefore = await prisma.pageView.count();
    expect(countBefore).toBe(3);

    // Déclencher la purge manuellement
    const res = await request(app.getHttpServer())
      .post('/api/admin-tenants/analytics/purge-test')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.purgedCount).toBe(1); // 1 entrée de 95 jours a été supprimée

    // Vérifier après la purge
    const remainingViews = await prisma.pageView.findMany();
    expect(remainingViews.length).toBe(2);
    for (const view of remainingViews) {
      expect(view.path).not.toBe('/app/old-page'); // celle-ci a été purgée
    }
  });
});
