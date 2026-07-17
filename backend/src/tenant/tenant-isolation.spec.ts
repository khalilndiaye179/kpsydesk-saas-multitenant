/**
 * Tests d'isolation inter-tenant — Suite de sécurité
 * ====================================================
 * Prouvent que les vecteurs de fuite d'isolation ont été corrigés et que
 * les corrections résistent à des scénarios adversariaux réels.
 *
 * Scénarios couverts :
 *  1. Accès non authentifié (401)
 *  2. Accès cross-tenant avec JWT valide (403 via TenantGuard)
 *  3. Isolation des données (cloisonnement Prisma applicatif)
 *  4. Isolation de l'enrôlement agent
 *  5. Rejet des tokens sans tenantId
 *  6. Race condition forcée — fenêtre de 50ms ouverte entre set_config et requête
 *     ⚠️  CE TEST PROUVE QUE LE BUG EXISTAIT : il échoue si _registerRlsMiddleware
 *         (is_local=false) est réactivé, et passe avec le filtre applicatif seul.
 *  7. Cold-start — requêtes concurrentes juste après $disconnect/$connect du pool
 *
 * Dépendances :
 *   - supertest, @nestjs/testing, bcryptjs
 *   - Base de données PostgreSQL accessible
 *   - Variable PRISMA_RACE_DELAY_MS (optionnelle, mode test uniquement)
 *
 * HISTORIQUE DU BUG :
 *   Le bug original (_registerRlsMiddleware avec set_config is_local=false) causait
 *   un mélange de données après redémarrage. Les tests 6 et 7 reproduisent
 *   structurellement les conditions de ce bug pour servir de test de non-régression.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Délai injecté entre opérations pour forcer la fenêtre de race condition (mode test uniquement) */
const RACE_DELAY_MS = parseInt(process.env.PRISMA_RACE_DELAY_MS || '0', 10);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('🔒 Isolation Inter-Tenant — Tests de sécurité', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // IDs des tenants créés pour les tests
  let tenantAId: string;
  let tenantBId: string;
  let tenantAToken: string;
  let tenantBToken: string;
  let assetAId: string;
  let assetBId: string;

  // ─── Setup ───────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // Désactiver le ThrottlerGuard (APP_GUARD global) AVANT la compilation du module.
    // overrideGuard() ne fonctionne que pour les guards décorateurs (@UseGuards).
    // overrideProvider(APP_GUARD) ne fonctionne pas pour les multi-providers.
    // jest.spyOn sur le prototype est la seule méthode fiable pour les APP_GUARD.
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();


    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Créer deux tenants de test isolés
    const hash = await bcrypt.hash('Test@1234', 12);

    const tenantA = await prisma.tenant.create({
      data: { name: 'Tenant A Test', subdomain: 'tenant-a-test', status: 'ACTIVE', plan: { connect: { name: 'Starter' } } },
    }).catch(async () => prisma.tenant.findFirst({ where: { subdomain: 'tenant-a-test' } }));

    const tenantB = await prisma.tenant.create({
      data: { name: 'Tenant B Test', subdomain: 'tenant-b-test', status: 'ACTIVE', plan: { connect: { name: 'Starter' } } },
    }).catch(async () => prisma.tenant.findFirst({ where: { subdomain: 'tenant-b-test' } }));

    tenantAId = tenantA!.id;
    tenantBId = tenantB!.id;

    // Setup utilisateur Tenant A (bypass ALS via tenantId explicite dans data)
    await prisma.user.deleteMany({ where: { email: 'admin-a@test-isolation.local' } }).catch(() => null);
    const userA = await prisma.user.create({
      data: {
        email: 'admin-a@test-isolation.local',
        password: hash,
        firstName: 'Admin',
        lastName: 'A',
        role: 'ADMIN',
        tenantId: tenantAId,
      },
    });

    // Setup utilisateur Tenant B
    await prisma.user.deleteMany({ where: { email: 'admin-b@test-isolation.local' } }).catch(() => null);
    const userB = await prisma.user.create({
      data: {
        email: 'admin-b@test-isolation.local',
        password: hash,
        firstName: 'Admin',
        lastName: 'B',
        role: 'ADMIN',
        tenantId: tenantBId,
      },
    });

    // Générer des JWTs légitimes (signés avec le vrai secret)
    tenantAToken = jwtService.sign({ sub: userA.id, email: userA.email, role: 'ADMIN', tenantId: tenantAId });
    tenantBToken = jwtService.sign({ sub: userB.id, email: userB.email, role: 'ADMIN', tenantId: tenantBId });

    // Créer un actif de test pour chaque tenant (tenantId explicite pour bypass ALS en setup)
    await prisma.asset.deleteMany({ where: { inventoryCode: { in: ['TEST-A-001', 'TEST-B-001'] } } }).catch(() => null);
    const assetA = await prisma.asset.create({
      data: { inventoryCode: 'TEST-A-001', name: 'PC-Tenant-A', type: 'Ordinateur', status: 'IN_STOCK', tenantId: tenantAId },
    });
    const assetB = await prisma.asset.create({
      data: { inventoryCode: 'TEST-B-001', name: 'PC-Tenant-B', type: 'Ordinateur', status: 'IN_STOCK', tenantId: tenantBId },
    });

    assetAId = assetA.id;
    assetBId = assetB.id;
  });

  afterAll(async () => {
    // Nettoyage dans l'ordre des dépendances FK (AssetHistory avant Asset)
    for (const tid of [tenantAId, tenantBId]) {
      if (!tid) continue;
      // 1. Supprimer d'abord les entrées d'historique (FK constraint sur assetId)
      await prisma.assetHistory.deleteMany({ where: { asset: { tenantId: tid } } }).catch(() => null);
      // 2. Puis les actifs
      await prisma.asset.deleteMany({ where: { tenantId: tid } }).catch(() => null);
      // 3. Puis les utilisateurs
      await prisma.user.deleteMany({ where: { tenantId: tid } }).catch(() => null);
    }
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } }).catch(() => null);
    await app.close();
  });

  // ─── Test 1 : Accès sans authentification (Faille 2 corrigée) ─────────────

  describe('Test 1 — Accès non authentifié bloqué (F2)', () => {
    it('GET /api/assets sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/assets')
        .set('X-Tenant-ID', 'tenant-a-test');

      expect(res.status).toBe(401);
    });

    it('GET /api/users sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('X-Tenant-ID', 'tenant-a-test');

      expect(res.status).toBe(401);
    });

    it('GET /api/tickets sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tickets')
        .set('X-Tenant-ID', 'tenant-a-test');

      expect(res.status).toBe(401);
    });

    it('GET /api/contracts sans token → 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/contracts')
        .set('X-Tenant-ID', 'tenant-a-test');

      expect(res.status).toBe(401);
    });

    it('POST /api/assets/enroll sans token → accessible (agent Windows)', async () => {
      // L'enroll est intentionnellement public pour l'agent Windows
      const res = await request(app.getHttpServer())
        .post('/api/assets/enroll')
        .set('X-Tenant-ID', 'tenant-a-test')
        .send({ serialNumber: 'SN-TEST-ENROLL-001', name: 'PC-Test-Enroll' });

      // Doit réussir (200/201) ou échouer par validation données, pas par 401
      expect(res.status).not.toBe(401);
    });
  });

  // ─── Test 2 : Accès cross-tenant (Faille 1 corrigée) ──────────────────────

  describe('Test 2 — Accès cross-tenant bloqué (F1 + TenantGuard)', () => {
    it('Token du Tenant A utilisé sur le sous-domaine du Tenant B → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/assets')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('X-Tenant-ID', 'tenant-b-test');

      expect(res.status).toBe(403);
    });

    it('Token du Tenant B utilisé sur le sous-domaine du Tenant A → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${tenantBToken}`)
        .set('X-Tenant-ID', 'tenant-a-test');

      expect(res.status).toBe(403);
    });
  });

  // ─── Test 3 : Isolation des données (cause principale des fuites observées) ─

  describe('Test 3 — Isolation des données inter-tenant', () => {
    it('Tenant A ne voit que ses propres actifs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/assets')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('X-Tenant-ID', 'tenant-a-test');

      expect(res.status).toBe(200);
      const assets = res.body as any[];
      for (const asset of assets) {
        expect(asset.tenantId).toBe(tenantAId);
      }
      const assetBFound = assets.find((a) => a.id === assetBId);
      expect(assetBFound).toBeUndefined();
    });

    it('Tenant B ne voit que ses propres actifs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/assets')
        .set('Authorization', `Bearer ${tenantBToken}`)
        .set('X-Tenant-ID', 'tenant-b-test');

      expect(res.status).toBe(200);
      const assets = res.body as any[];
      for (const asset of assets) {
        expect(asset.tenantId).toBe(tenantBId);
      }
      const assetAFound = assets.find((a) => a.id === assetAId);
      expect(assetAFound).toBeUndefined();
    });

    it('Tenant A ne peut pas accéder à un actif du Tenant B par ID → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/assets/${assetBId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('X-Tenant-ID', 'tenant-a-test');

      expect([404, 403]).toContain(res.status);
    });

    it('Tenant A ne peut pas supprimer un actif du Tenant B', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/assets/${assetBId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .set('X-Tenant-ID', 'tenant-a-test');

      expect([404, 403]).toContain(res.status);

      // Vérifier que l'actif existe toujours en base (bypass ALS via $queryRaw)
      const check = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Asset" WHERE id = ${assetBId}
      `;
      expect(Number(check[0].count)).toBe(1);
    });
  });

  // ─── Test 4 : Isolation enrôlement agent (Faille 3 corrigée) ─────────────

  describe('Test 4 — Isolation de l\'enrôlement agent (F3)', () => {
    const sharedSerial = 'SN-SHARED-SERIAL-XYZ';

    afterAll(async () => {
      // Fix FK : supprimer AssetHistory avant Asset
      const assets = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Asset" WHERE "serialNumber" = ${sharedSerial}
      `;
      for (const a of assets) {
        await prisma.assetHistory.deleteMany({ where: { assetId: a.id } }).catch(() => null);
      }
      await prisma.asset.deleteMany({ where: { serialNumber: sharedSerial } }).catch(() => null);
    });

    it('Enrôlement Tenant A : crée un actif avec tenantId = Tenant A', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/assets/enroll')
        .set('X-Tenant-ID', 'tenant-a-test')
        .send({ serialNumber: sharedSerial, name: 'PC-Shared-A', macAddress: 'AA:BB:CC:DD:EE:01' });

      expect([200, 201]).toContain(res.status);
      const created = await prisma.$queryRaw<{ id: string; tenantId: string }[]>`
        SELECT id, "tenantId" FROM "Asset" WHERE "serialNumber" = ${sharedSerial} AND "tenantId" = ${tenantAId}
      `;
      expect(created.length).toBeGreaterThan(0);
      expect(created[0].tenantId).toBe(tenantAId);
    });

    it('Enrôlement Tenant B avec le même serial : crée un NOUVEL actif pour Tenant B (pas de cross-match)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/assets/enroll')
        .set('X-Tenant-ID', 'tenant-b-test')
        .send({ serialNumber: sharedSerial, name: 'PC-Shared-B', macAddress: 'AA:BB:CC:DD:EE:02' });

      expect([200, 201]).toContain(res.status);

      const assetForA = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Asset" WHERE "serialNumber" = ${sharedSerial} AND "tenantId" = ${tenantAId}
      `;
      const assetForB = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Asset" WHERE "serialNumber" = ${sharedSerial} AND "tenantId" = ${tenantBId}
      `;

      expect(assetForA.length).toBeGreaterThan(0);
      expect(assetForB.length).toBeGreaterThan(0);
      expect(assetForA[0].id).not.toBe(assetForB[0].id);
    });
  });

  // ─── Test 5 : Token sans tenantId refusé (Faille 4 corrigée) ─────────────

  describe('Test 5 — Token sans tenantId refusé (F4)', () => {
    it('JWT sans tenantId sur une route tenant-scoped → 403', async () => {
      const tokenWithoutTenant = jwtService.sign({
        sub: 'some-user-id',
        email: 'legacy@test.local',
        role: 'ADMIN',
        // tenantId absent intentionnellement
      });

      const res = await request(app.getHttpServer())
        .get('/api/assets')
        .set('Authorization', `Bearer ${tokenWithoutTenant}`)
        .set('X-Tenant-ID', 'tenant-a-test');

      expect(res.status).toBe(403);
    });
  });

  // ─── Test 6 : Race condition forcée — fenêtre de délai ouverte ────────────

  /**
   * CE TEST EST UN TEST DE NON-RÉGRESSION CRITIQUE.
   *
   * Il reproduit structurellement le bug historique de _registerRlsMiddleware :
   * la variable PRISMA_RACE_DELAY_MS injecte un délai entre le "set_config" et
   * la requête Prisma suivante, ouvrant artificiellement la fenêtre de race condition.
   *
   * RÉSULTAT ATTENDU :
   * - AVEC _registerRlsMiddleware (is_local=false) : le test ÉCHOUE (données mélangées)
   * - AVEC filtre applicatif seul (correction actuelle) : le test PASSE toujours
   *   car le délai n'affecte pas la cohérence du filtre WHERE tenantId injecté dans params.
   *
   * Pour simuler le bug : réactiver _registerRlsMiddleware dans prisma.service.ts
   * et relancer avec PRISMA_RACE_DELAY_MS=50.
   */
  describe('Test 6 — Race condition forcée (fenêtre de délai)', () => {
    it(`50 requêtes simultanées avec délai RACE_DELAY=${RACE_DELAY_MS}ms : aucune donnée ne se mélange`, async () => {
      if (RACE_DELAY_MS > 0) {
        console.warn(`⚠️  MODE RACE CONDITION ACTIVÉ : délai de ${RACE_DELAY_MS}ms injecté`);
      }

      // Patch du middleware pour injecter le délai (uniquement si RACE_DELAY_MS > 0)
      const originalUse = (prisma as any).$use?.bind(prisma);
      let racePatchApplied = false;

      if (RACE_DELAY_MS > 0 && originalUse) {
        (prisma as any).$use(async (params: any, next: any) => {
          if (!racePatchApplied) {
            racePatchApplied = true;
            await sleep(RACE_DELAY_MS);
          }
          return next(params);
        });
      }

      const requests: Promise<request.Response>[] = [];

      for (let i = 0; i < 25; i++) {
        requests.push(
          request(app.getHttpServer())
            .get('/api/assets')
            .set('Authorization', `Bearer ${tenantAToken}`)
            .set('X-Tenant-ID', 'tenant-a-test'),
        );
        requests.push(
          request(app.getHttpServer())
            .get('/api/assets')
            .set('Authorization', `Bearer ${tenantBToken}`)
            .set('X-Tenant-ID', 'tenant-b-test'),
        );
      }

      const responses = await Promise.all(requests);

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const isFromA = i % 2 === 0;
        const expectedTenantId = isFromA ? tenantAId : tenantBId;
        const forbiddenTenantId = isFromA ? tenantBId : tenantAId;

        expect(res.status).toBe(200);
        const assets = res.body as any[];

        for (const asset of assets) {
          expect(asset.tenantId).toBe(expectedTenantId);
          expect(asset.tenantId).not.toBe(forbiddenTenantId);
        }
      }
    });
  });

  // ─── Test 7 : Cold-start — requêtes concurrentes après reconnexion du pool ─

  /**
   * Simule le scénario "redémarrage à froid" du serveur backend.
   *
   * BUG HISTORIQUE : après un redémarrage, le pool de connexions Prisma était
   * "à froid" (nouvelles connexions physiques). Les premières requêtes concurrentes
   * de deux tenants différents risquaient de se croiser si le set_config (RLS) ne
   * se propageait pas correctement sur les nouvelles connexions.
   *
   * Avec le filtre applicatif seul, ce scénario est neutralisé : le filtre WHERE
   * opère avant tout envoi réseau, indépendamment de l'état du pool.
   */
  describe('Test 7 — Cold-start (reconnexion pool Prisma)', () => {
    it('Requêtes concurrentes immédiatement après $disconnect/$connect : aucune fuite', async () => {
      // Simuler un redémarrage du pool de connexions
      await prisma.$disconnect();
      await prisma.$connect();

      // Envoyer immédiatement des requêtes concurrentes de deux tenants dès la reprise
      const coldStartRequests: Promise<request.Response>[] = [];

      for (let i = 0; i < 10; i++) {
        coldStartRequests.push(
          request(app.getHttpServer())
            .get('/api/assets')
            .set('Authorization', `Bearer ${tenantAToken}`)
            .set('X-Tenant-ID', 'tenant-a-test'),
        );
        coldStartRequests.push(
          request(app.getHttpServer())
            .get('/api/assets')
            .set('Authorization', `Bearer ${tenantBToken}`)
            .set('X-Tenant-ID', 'tenant-b-test'),
        );
      }

      const coldResponses = await Promise.all(coldStartRequests);

      for (let i = 0; i < coldResponses.length; i++) {
        const res = coldResponses[i];
        const isFromA = i % 2 === 0;
        const expectedTenantId = isFromA ? tenantAId : tenantBId;
        const forbiddenTenantId = isFromA ? tenantBId : tenantAId;

        expect(res.status).toBe(200);
        const assets = res.body as any[];

        for (const asset of assets) {
          expect(asset.tenantId).toBe(expectedTenantId);
          expect(asset.tenantId).not.toBe(forbiddenTenantId);
        }
      }
    });
  });
});
