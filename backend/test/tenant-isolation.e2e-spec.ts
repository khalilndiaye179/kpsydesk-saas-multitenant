import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

/**
 * Tests E2E d'isolation inter-tenant (Sécurité critique)
 * 
 * Ces tests vérifient que l'architecture multi-tenant respecte l'isolation stricte :
 * un utilisateur du Tenant A ne peut en aucun cas accéder aux données du Tenant B,
 * même avec un token JWT valide.
 * 
 * ⚠️  Nécessite une base de données PostgreSQL de test (TEST_DATABASE_URL).
 *     Se joue avant la mise en production et dans le CI/CD.
 * 
 * Setup : 2 tenants, 2 utilisateurs, 2 actifs (un par tenant).
 * Assertions : toutes les opérations cross-tenant doivent être bloquées.
 */
describe('Isolation Multi-Tenant (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Données des 2 tenants de test
  let tenantA: { id: string; subdomain: string };
  let tenantB: { id: string; subdomain: string };
  let userA: { id: string; token: string };
  let userB: { id: string; token: string };
  let assetAId: string; // Actif appartenant au Tenant A
  let assetBId: string; // Actif appartenant au Tenant B

  // ── Setup ────────────────────────────────────────────────────────────────

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

  /**
   * Création des données de test via Prisma direct (bypass ALS pour le setup).
   * Utilise $queryRaw pour être sûr de contourner les middlewares tenant.
   */
  async function _setupTestData() {
    // Plan de test
    const plan = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Plan" (id, name, "quotaAssets", "quotaUsers", price, "isPublic", "createdAt")
      VALUES (gen_random_uuid(), 'TestPlan', 1000, 100, 0, false, NOW())
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const planId = plan[0].id;

    // Tenant A
    const tA = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Tenant" (id, name, subdomain, status, "planId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'Tenant A Test', 'e2e-tenant-a', 'ACTIVE', ${planId}, NOW(), NOW())
      ON CONFLICT (subdomain) DO UPDATE SET subdomain = EXCLUDED.subdomain
      RETURNING id
    `;
    tenantA = { id: tA[0].id, subdomain: 'e2e-tenant-a' };

    // Tenant B
    const tB = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Tenant" (id, name, subdomain, status, "planId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'Tenant B Test', 'e2e-tenant-b', 'ACTIVE', ${planId}, NOW(), NOW())
      ON CONFLICT (subdomain) DO UPDATE SET subdomain = EXCLUDED.subdomain
      RETURNING id
    `;
    tenantB = { id: tB[0].id, subdomain: 'e2e-tenant-b' };

    const hashedPass = await bcrypt.hash('test-password-123', 10);

    // User A
    const uA = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "systemRole", status, "tenantId")
      VALUES (gen_random_uuid(), 'admin@e2e-tenant-a.test', ${hashedPass}, 'Admin', 'A', 'ADMIN', 'Admin IT', 'Actif', ${tenantA.id})
      ON CONFLICT (email, "tenantId") DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `;
    userA = {
      id: uA[0].id,
      token: jwtService.sign({ sub: uA[0].id, email: 'admin@e2e-tenant-a.test', role: 'ADMIN', tenantId: tenantA.id }),
    };

    // User B
    const uB = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "systemRole", status, "tenantId")
      VALUES (gen_random_uuid(), 'admin@e2e-tenant-b.test', ${hashedPass}, 'Admin', 'B', 'ADMIN', 'Admin IT', 'Actif', ${tenantB.id})
      ON CONFLICT (email, "tenantId") DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `;
    userB = {
      id: uB[0].id,
      token: jwtService.sign({ sub: uB[0].id, email: 'admin@e2e-tenant-b.test', role: 'ADMIN', tenantId: tenantB.id }),
    };

    // Asset A
    const aA = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Asset" (id, "inventoryCode", name, type, status, "tenantId")
      VALUES (gen_random_uuid(), 'E2E-ASSET-A-001', 'Laptop Tenant A', 'Ordinateur portable', 'ASSIGNED', ${tenantA.id})
      RETURNING id
    `;
    assetAId = aA[0].id;

    // Asset B
    const aB = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Asset" (id, "inventoryCode", name, type, status, "tenantId")
      VALUES (gen_random_uuid(), 'E2E-ASSET-B-001', 'Laptop Tenant B', 'Ordinateur portable', 'ASSIGNED', ${tenantB.id})
      RETURNING id
    `;
    assetBId = aB[0].id;
  }

  async function _cleanupTestData() {
    // Nettoyage dans l'ordre des dépendances FK
    await prisma.$executeRaw`DELETE FROM "Asset" WHERE "inventoryCode" LIKE 'E2E-ASSET-%'`;
    await prisma.$executeRaw`DELETE FROM "User" WHERE email LIKE '%@e2e-tenant-%.test'`;
    await prisma.$executeRaw`DELETE FROM "Subscription" WHERE "tenantId" IN (
      SELECT id FROM "Tenant" WHERE subdomain IN ('e2e-tenant-a', 'e2e-tenant-b')
    )`;
    await prisma.$executeRaw`DELETE FROM "Tenant" WHERE subdomain IN ('e2e-tenant-a', 'e2e-tenant-b')`;
  }

  // ── Tests d'isolation — Lecture ──────────────────────────────────────────

  describe('🔒 Isolation en lecture (GET)', () => {
    it('Tenant A ne voit QUE ses propres actifs (pas ceux de B)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/assets')
        .set('Authorization', `Bearer ${userA.token}`)
        .set('X-Tenant-ID', tenantA.subdomain)
        .expect(200);

      const assets: any[] = res.body;
      const ids = assets.map((a: any) => a.id);

      // L'actif A doit être présent
      expect(ids).toContain(assetAId);
      // L'actif B ne doit PAS être présent
      expect(ids).not.toContain(assetBId);

      // Tous les actifs retournés doivent appartenir au Tenant A
      assets.forEach(asset => {
        expect(asset.tenantId).toBe(tenantA.id);
      });
    });

    it('Tenant B ne voit QUE ses propres actifs (pas ceux de A)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/assets')
        .set('Authorization', `Bearer ${userB.token}`)
        .set('X-Tenant-ID', tenantB.subdomain)
        .expect(200);

      const assets: any[] = res.body;
      const ids = assets.map((a: any) => a.id);

      expect(ids).toContain(assetBId);
      expect(ids).not.toContain(assetAId);
    });

    it('🔒 Tenant A NE PEUT PAS lire l\'actif B par son ID direct', async () => {
      // User A essaie d'accéder directement à l'ID de l'actif du Tenant B
      await request(app.getHttpServer())
        .get(`/api/assets/${assetBId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .set('X-Tenant-ID', tenantA.subdomain)
        .expect(404); // Doit être 404, pas 403, pour ne pas révéler l'existence de la ressource
    });

    it('🔒 Tenant B NE PEUT PAS lire l\'actif A par son ID direct', async () => {
      await request(app.getHttpServer())
        .get(`/api/assets/${assetAId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .set('X-Tenant-ID', tenantB.subdomain)
        .expect(404);
    });

    it('🔒 Token du Tenant A avec X-Tenant-ID du Tenant B → 403', async () => {
      // Attaque : l'utilisateur de A essaie de forger l'identité de B
      await request(app.getHttpServer())
        .get('/api/assets')
        .set('Authorization', `Bearer ${userA.token}`) // JWT du Tenant A
        .set('X-Tenant-ID', tenantB.subdomain)          // Contexte du Tenant B
        .expect(403); // TenantGuard doit bloquer
    });
  });

  // ── Tests d'isolation — Écriture ─────────────────────────────────────────

  describe('🔒 Isolation en écriture (PUT/DELETE)', () => {
    it('🔒 Tenant A NE PEUT PAS modifier l\'actif du Tenant B', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/assets/${assetBId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .set('X-Tenant-ID', tenantA.subdomain)
        .send({ name: 'HACKED BY TENANT A' });

      // Doit être 404 (filtre tenantId empêche de trouver l'actif) ou 400
      expect([404, 400]).toContain(res.status);

      // Vérification directe en base : le nom ne doit pas avoir changé
      const check = await prisma.$queryRaw<[{ name: string }]>`
        SELECT name FROM "Asset" WHERE id = ${assetBId}
      `;
      expect(check[0].name).toBe('Laptop Tenant B');
    });

    it('🔒 Tenant A NE PEUT PAS supprimer l\'actif du Tenant B', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/assets/${assetBId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .set('X-Tenant-ID', tenantA.subdomain);

      expect([404, 400]).toContain(res.status);

      // L'actif B doit toujours exister
      const check = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Asset" WHERE id = ${assetBId}
      `;
      expect(Number(check[0].count)).toBe(1);
    });
  });

  // ── Tests d'isolation — Utilisateurs ─────────────────────────────────────

  describe('🔒 Isolation des utilisateurs', () => {
    it('Tenant A ne peut pas voir les utilisateurs du Tenant B', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${userA.token}`)
        .set('X-Tenant-ID', tenantA.subdomain)
        .expect(200);

      const users: any[] = res.body;
      const userIds = users.map((u: any) => u.id);

      expect(userIds).not.toContain(userB.id);
      users.forEach(user => {
        expect(user.tenantId).toBe(tenantA.id);
      });
    });
  });

  // ── Tests d'authentification ──────────────────────────────────────────────

  describe('🔒 Authentification tenant-aware', () => {
    it('Login avec credentials Tenant A dans contexte Tenant B → 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Tenant-ID', tenantB.subdomain) // Contexte du Tenant B
        .send({
          email: 'admin@e2e-tenant-a.test', // Credentials du Tenant A
          password: 'test-password-123',
        })
        .expect(401); // L'utilisateur n'existe pas dans le Tenant B
    });

    it('Login avec credentials Tenant A dans contexte Tenant A → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Tenant-ID', tenantA.subdomain)
        .send({
          email: 'admin@e2e-tenant-a.test',
          password: 'test-password-123',
        });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.tenantId).toBe(tenantA.id);
    });

    it('Sans token JWT → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/assets')
        .set('X-Tenant-ID', tenantA.subdomain)
        .expect(401);
    });
  });

  // ── Tests de création avec quota ──────────────────────────────────────────

  describe('🔒 Création isolée', () => {
    it('Un actif créé par Tenant A appartient bien au Tenant A', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/assets')
        .set('Authorization', `Bearer ${userA.token}`)
        .set('X-Tenant-ID', tenantA.subdomain)
        .send({
          inventoryCode: 'E2E-ASSET-A-CREATE-001',
          name: 'Actif créé par A',
          type: 'Ordinateur portable',
          status: 'ASSIGNED',
        });

      if (res.status === 201) {
        const createdId = res.body.id;
        // Vérification en base que tenantId = tenantA.id
        const check = await prisma.$queryRaw<[{ tenantId: string }]>`
          SELECT "tenantId" FROM "Asset" WHERE id = ${createdId}
        `;
        expect(check[0].tenantId).toBe(tenantA.id);

        // Nettoyage
        await prisma.$executeRaw`DELETE FROM "Asset" WHERE id = ${createdId}`;
      }
      // 201 ou 409 (conflit code) sont acceptables
      expect([201, 409]).toContain(res.status);
    });

    it("TENTATIVE D'INJECTION CROSS-TENANT via extra.controller : créer un département sur Tenant A en passant le tenantId de Tenant B dans le body → neutralisé", async () => {
      const res = await request(app.getHttpServer())
        .post('/api/departments')
        .set('Authorization', `Bearer ${userA.token}`)
        .set('X-Tenant-ID', tenantA.subdomain)
        .send({
          name: 'Departement E2E Inject',
          tenantId: tenantB.id, // Tentative d'injection
        });

      expect(res.status).toBe(201);
      const createdId = res.body.id;

      // Vérification directe en base de données que le tenantId attribué est bien celui du contexte (Tenant A) et non celui injecté (Tenant B)
      const check = await prisma.$queryRaw<[{ tenantId: string }]>`
        SELECT "tenantId" FROM "Department" WHERE id = ${createdId}
      `;
      expect(check[0].tenantId).toBe(tenantA.id);
      expect(check[0].tenantId).not.toBe(tenantB.id);

      // Nettoyage de la base de données
      await prisma.$executeRaw`DELETE FROM "Department" WHERE id = ${createdId}`;
    });
  });
});
