import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

describe('RBAC Rights Enforcement (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenant: { id: string; subdomain: string };
  let admin: { id: string; token: string };
  let standardUser: { id: string; token: string };
  let anotherUser: { id: string; token: string };
  
  let assetAId: string; // assigned to standardUser
  let assetBId: string; // assigned to anotherUser
  let ticketId: string; // created by standardUser

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await _setupTestData();
  });

  afterAll(async () => {
    await _cleanupTestData();
    await app.close();
  });

  async function _setupTestData() {
    const plan = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Plan" (id, name, "quotaAssets", "quotaUsers", price, "isPublic", "createdAt")
      VALUES (gen_random_uuid(), 'RBACPlan', 1000, 100, 0, false, NOW())
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const planId = plan[0].id;

    const t = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Tenant" (id, name, subdomain, status, "planId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'RBAC Tenant', 'rbac-tenant', 'ACTIVE', ${planId}, NOW(), NOW())
      RETURNING id
    `;
    tenant = { id: t[0].id, subdomain: 'rbac-tenant' };

    const hashedPass = await bcrypt.hash('rbac-pass-123', 10);

    const uAdmin = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "systemRole", status, "tenantId")
      VALUES (gen_random_uuid(), 'admin@rbac.test', ${hashedPass}, 'Admin', 'RBAC', 'ADMIN', 'Admin IT', 'Actif', ${tenant.id})
      RETURNING id
    `;
    admin = {
      id: uAdmin[0].id,
      token: jwtService.sign({ sub: uAdmin[0].id, email: 'admin@rbac.test', role: 'ADMIN', tenantId: tenant.id }),
    };

    const uUser = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "systemRole", status, "tenantId")
      VALUES (gen_random_uuid(), 'user@rbac.test', ${hashedPass}, 'User', 'RBAC', 'USER', 'Utilisateur Standard', 'Actif', ${tenant.id})
      RETURNING id
    `;
    standardUser = {
      id: uUser[0].id,
      token: jwtService.sign({ sub: uUser[0].id, email: 'user@rbac.test', role: 'USER', tenantId: tenant.id }),
    };

    const uAnother = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "systemRole", status, "tenantId")
      VALUES (gen_random_uuid(), 'another@rbac.test', ${hashedPass}, 'Another', 'RBAC', 'USER', 'Utilisateur Standard', 'Actif', ${tenant.id})
      RETURNING id
    `;
    anotherUser = {
      id: uAnother[0].id,
      token: jwtService.sign({ sub: uAnother[0].id, email: 'another@rbac.test', role: 'USER', tenantId: tenant.id }),
    };

    const aA = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Asset" (id, "inventoryCode", name, type, status, "tenantId", "userId")
      VALUES (gen_random_uuid(), 'RBAC-ASSET-01', 'User laptop', 'Ordinateur portable', 'ASSIGNED', ${tenant.id}, ${standardUser.id})
      RETURNING id
    `;
    assetAId = aA[0].id;

    const aB = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Asset" (id, "inventoryCode", name, type, status, "tenantId", "userId")
      VALUES (gen_random_uuid(), 'RBAC-ASSET-02', 'Another laptop', 'Ordinateur portable', 'ASSIGNED', ${tenant.id}, ${anotherUser.id})
      RETURNING id
    `;
    assetBId = aB[0].id;

    const tick = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Ticket" (id, title, description, status, priority, "creatorId", "tenantId", "createdAt")
      VALUES (gen_random_uuid(), 'Incident clavier', 'Touche bloquée', 'OPEN', 'LOW', ${standardUser.id}, ${tenant.id}, NOW())
      RETURNING id
    `;
    ticketId = tick[0].id;
  }

  async function _cleanupTestData() {
    await prisma.$executeRaw`DELETE FROM "Ticket" WHERE "tenantId" = ${tenant.id}`;
    await prisma.$executeRaw`DELETE FROM "Asset" WHERE "inventoryCode" LIKE 'RBAC-ASSET-%'`;
    await prisma.$executeRaw`DELETE FROM "User" WHERE email LIKE '%@rbac.test'`;
    await prisma.$executeRaw`DELETE FROM "Subscription" WHERE "tenantId" = ${tenant.id}`;
    await prisma.$executeRaw`DELETE FROM "Tenant" WHERE id = ${tenant.id}`;
  }

  // ── Tests Droits Équipements (Assets) ──────────────────────────────────────

  describe('Assets RBAC', () => {
    it('Simple user ne voit que les actifs qui lui sont assignés', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/assets')
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .expect(200);

      const assets: any[] = res.body;
      const ids = assets.map(a => a.id);
      expect(ids).toContain(assetAId);
      expect(ids).not.toContain(assetBId);
    });

    it('Simple user ne peut pas lire un actif qui ne lui est pas assigné', async () => {
      await request(app.getHttpServer())
        .get(`/api/assets/${assetBId}`)
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .expect(403);
    });

    it('Simple user ne peut pas créer un actif', async () => {
      await request(app.getHttpServer())
        .post('/api/assets')
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .send({
          inventoryCode: 'RBAC-ASSET-03',
          name: 'Forbidden PC',
          type: 'Ordinateur portable',
        })
        .expect(403);
    });

    it('Simple user ne peut pas supprimer un actif', async () => {
      await request(app.getHttpServer())
        .delete(`/api/assets/${assetAId}`)
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .expect(403);
    });
  });

  // ── Tests Droits Utilisateurs (Users) ──────────────────────────────────────

  describe('Users RBAC', () => {
    it('Simple user ne peut pas lister les utilisateurs', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .expect(403);
    });

    it('Simple user peut voir son propre profil', async () => {
      await request(app.getHttpServer())
        .get(`/api/users/${standardUser.id}`)
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .expect(200);
    });

    it('Simple user ne peut pas voir le profil d\'un autre', async () => {
      await request(app.getHttpServer())
        .get(`/api/users/${anotherUser.id}`)
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .expect(403);
    });
  });

  // ── Tests Droits Tickets (Tickets) ─────────────────────────────────────────

  describe('Tickets RBAC', () => {
    it('Simple user ne voit que les tickets qu\'il a créés', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tickets')
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .expect(200);

      const tickets: any[] = res.body;
      const creatorIds = tickets.map(t => t.creatorId);
      expect(creatorIds.every(id => id === standardUser.id)).toBe(true);
    });

    it('Simple user ne peut pas assigner un ticket', async () => {
      await request(app.getHttpServer())
        .put(`/api/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .send({ assigneeId: anotherUser.id })
        .expect(403);
    });
  });

  // ── Tests Droits Entités Secondaires (Extra) ──────────────────────────────

  describe('Extra/Secondaries RBAC', () => {
    it('Simple user ne peut pas voir les licences', async () => {
      await request(app.getHttpServer())
        .get('/api/licenses')
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .expect(403);
    });

    it('Simple user peut lire la base de connaissances (kb)', async () => {
      await request(app.getHttpServer())
        .get('/api/kb')
        .set('Authorization', `Bearer ${standardUser.token}`)
        .set('X-Tenant-ID', tenant.subdomain)
        .expect(200);
    });
  });
});
