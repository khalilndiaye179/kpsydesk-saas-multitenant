import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SubscriptionLifecycleService } from '../src/tenant/subscription-lifecycle.service';

describe('Subscription Lifecycle & Grace Period (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let lifecycleService: SubscriptionLifecycleService;

  let tenant: { id: string; subdomain: string };
  let user: { id: string; token: string };
  let assetId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    lifecycleService = moduleFixture.get<SubscriptionLifecycleService>(SubscriptionLifecycleService);

    await _setupTestData();
  });

  afterAll(async () => {
    await _cleanupTestData();
    await app.close();
  });

  async function _setupTestData() {
    // 1. Create a Plan
    const plan = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Plan" (id, name, "quotaAssets", "quotaUsers", price, "isPublic", "createdAt")
      VALUES (gen_random_uuid(), 'E2E-Lifecycle-Plan', 1000, 100, 5000, true, NOW())
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const planId = plan[0].id;

    // 2. Create a Tenant
    const t = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Tenant" (id, name, subdomain, status, "planId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'E2E Lifecycle Tenant', 'e2e-lifecycle-tenant', 'ACTIVE', ${planId}, NOW(), NOW())
      RETURNING id
    `;
    tenant = { id: t[0].id, subdomain: 'e2e-lifecycle-tenant' };

    // 3. Create a Subscription
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await prisma.$queryRaw`
      INSERT INTO "Subscription" (id, "tenantId", "planId", status, "billingInterval", "startDate", "endDate", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${tenant.id}, ${planId}, 'ACTIVE', 'MONTHLY', NOW(), ${tomorrow}, NOW(), NOW())
    `;

    // 4. Create an Admin User
    const hashedPass = await bcrypt.hash('test-password-123', 10);
    const u = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "systemRole", status, "tenantId")
      VALUES (gen_random_uuid(), 'admin@e2e-lifecycle.test', ${hashedPass}, 'Admin', 'Lifecycle', 'ADMIN', 'Admin IT', 'Actif', ${tenant.id})
      RETURNING id
    `;
    user = {
      id: u[0].id,
      token: jwtService.sign({ sub: u[0].id, email: 'admin@e2e-lifecycle.test', role: 'ADMIN', tenantId: tenant.id }),
    };

    // 5. Create an Asset (for integrity verification)
    const a = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO "Asset" (id, "inventoryCode", name, type, status, "tenantId")
      VALUES (gen_random_uuid(), 'E2E-LIFECYCLE-ASSET-001', 'Integrity Laptop', 'Ordinateur portable', 'IN_STOCK', ${tenant.id})
      RETURNING id
    `;
    assetId = a[0].id;
  }

  async function _cleanupTestData() {
    await prisma.$executeRaw`DELETE FROM "Asset" WHERE "inventoryCode" = 'E2E-LIFECYCLE-ASSET-001'`;
    await prisma.$executeRaw`DELETE FROM "User" WHERE email = 'admin@e2e-lifecycle.test'`;
    await prisma.$executeRaw`DELETE FROM "Subscription" WHERE "tenantId" = ${tenant.id}`;
    await prisma.$executeRaw`DELETE FROM "Tenant" WHERE subdomain = 'e2e-lifecycle-tenant'`;
    await prisma.$executeRaw`DELETE FROM "Plan" WHERE name = 'E2E-Lifecycle-Plan'`;
  }

  it('1. Initial State: active and has full access', async () => {
    // Check access
    const res = await request(app.getHttpServer())
      .get('/api/assets')
      .set('Authorization', `Bearer ${user.token}`)
      .set('X-Tenant-ID', tenant.subdomain)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(assetId);
  });

  it('2. Grace Period: expiry date 1 day ago -> status GRACE_PERIOD, still has access', async () => {
    // Move endDate to 1 day in the past (24h ago)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await prisma.subscription.updateMany({
      where: { tenantId: tenant.id },
      data: { endDate: yesterday },
    });

    // Run process cycles
    await lifecycleService.processCycles();

    // Verify DB states
    const updatedTenant = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    const updatedSub = await prisma.subscription.findFirst({ where: { tenantId: tenant.id } });
    expect(updatedTenant.status).toBe('GRACE_PERIOD');
    expect(updatedSub.status).toBe('GRACE_PERIOD');

    // Verify API access works
    const res = await request(app.getHttpServer())
      .get('/api/assets')
      .set('Authorization', `Bearer ${user.token}`)
      .set('X-Tenant-ID', tenant.subdomain)
      .expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('3. Suspension: expiry date 3 days ago -> status SUSPENDED, API is blocked (403), except bypass routes', async () => {
    // Move endDate to 3 days in the past
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    await prisma.subscription.updateMany({
      where: { tenantId: tenant.id },
      data: { endDate: threeDaysAgo, status: 'GRACE_PERIOD' },
    });

    // Run process cycles
    await lifecycleService.processCycles();

    // Verify DB states
    const updatedTenant = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    const updatedSub = await prisma.subscription.findFirst({ where: { tenantId: tenant.id } });
    expect(updatedTenant.status).toBe('SUSPENDED');
    expect(updatedSub.status).toBe('PAST_DUE');

    // Verify API general assets is blocked (403)
    await request(app.getHttpServer())
      .get('/api/assets')
      .set('Authorization', `Bearer ${user.token}`)
      .set('X-Tenant-ID', tenant.subdomain)
      .expect(403);

    // Verify bypass route (/api/tenants/me) works (200)
    await request(app.getHttpServer())
      .get('/api/tenants/me')
      .set('Authorization', `Bearer ${user.token}`)
      .set('X-Tenant-ID', tenant.subdomain)
      .expect(200);
  });

  it('4. Reactivation & Data Integrity: webhook confirm payment -> status ACTIVE, access restored, assets intact', async () => {
    // Trigger public webhook
    await request(app.getHttpServer())
      .post('/api/subscriptions/webhook')
      .send({ tenantId: tenant.id, status: 'success' })
      .expect(200);

    // Verify DB states
    const updatedTenant = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    const updatedSub = await prisma.subscription.findFirst({ where: { tenantId: tenant.id } });
    expect(updatedTenant.status).toBe('ACTIVE');
    expect(updatedSub.status).toBe('ACTIVE');
    expect(updatedSub.endDate.getTime()).toBeGreaterThan(Date.now());

    // Verify API access restored and data is intact
    const res = await request(app.getHttpServer())
      .get('/api/assets')
      .set('Authorization', `Bearer ${user.token}`)
      .set('X-Tenant-ID', tenant.subdomain)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(assetId);
  });
});
