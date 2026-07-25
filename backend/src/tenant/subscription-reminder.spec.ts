import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SmsNotificationService } from './sms-notification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('🔔 Relances Automatiques Expé (Livrable A) — Suite de Tests', () => {
  let service: SubscriptionLifecycleService;
  let smsService: SmsNotificationService;
  let prisma: PrismaService;

  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        PrismaService,
        SmsNotificationService,
      ],
    }).compile();

    service = module.get<SubscriptionLifecycleService>(SubscriptionLifecycleService);
    smsService = module.get<SmsNotificationService>(SmsNotificationService);
    prisma = module.get<PrismaService>(PrismaService);

    // 1. Setup plan & tenants
    const plan = await prisma.plan.findFirst();
    const planId = plan?.id;

    const tenantA = await prisma.tenant.create({
      data: { name: 'Tenant Reminder A', subdomain: 'tenant-a-rem', status: 'ACTIVE', planId }
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: { name: 'Tenant Reminder B', subdomain: 'tenant-b-rem', status: 'ACTIVE', planId }
    });
    tenantBId = tenantB.id;

    // 2. Setup user admins with phone numbers
    await prisma.user.create({
      data: {
        email: 'admin@tenant-a-rem.com',
        firstName: 'Admin',
        lastName: 'A',
        password: 'none',
        role: 'ADMIN',
        tenantId: tenantAId,
        phone: '+221771112233'
      }
    });

    await prisma.user.create({
      data: {
        email: 'admin@tenant-b-rem.com',
        firstName: 'Admin',
        lastName: 'B',
        password: 'none',
        role: 'ADMIN',
        tenantId: tenantBId,
        phone: '+221774445566'
      }
    });

    // Clean logs
    await prisma.subscriptionReminderLog.deleteMany({});
  });

  afterAll(async () => {
    // Teardown
    await prisma.subscriptionReminderLog.deleteMany({});
    await prisma.subscription.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@tenant-a-rem.com', 'admin@tenant-b-rem.com'] } }
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } }
    });
  });

  beforeEach(async () => {
    // Delete test subs before each test to start fresh
    await prisma.subscription.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await prisma.subscriptionReminderLog.deleteMany({});
  });

  it('🟢 Test 1 : Le cron continue de fonctionner sans clé API SMS configurée', async () => {
    // Configure empty API key
    delete process.env.SMS_API_KEY;

    // Créer une subscription J-7
    const dateJ7 = new Date();
    dateJ7.setDate(dateJ7.getDate() + 7);

    const sub = await prisma.subscription.create({
      data: {
        tenantId: tenantAId,
        planId: (await prisma.plan.findFirst())!.id,
        status: 'ACTIVE',
        endDate: dateJ7
      }
    });

    const sendSpy = jest.spyOn(smsService, 'sendSms');

    // Déclencher
    await expect(service.handleCron()).resolves.not.toThrow();

    // Doit avoir simulé l'envoi de SMS (car pas d'API key)
    expect(sendSpy).toHaveBeenCalled();
    sendSpy.mockRestore();

    // Log enregistré
    const log = await prisma.subscriptionReminderLog.findFirst({
      where: { subscriptionId: sub.id, reminderDays: 7 }
    });
    expect(log).toBeDefined();
    expect(log?.status).toBe('SUCCESS');
  });

  it('🟢 Test 2 : Idempotence - La notification J-7 et J-1 ne part pas en double', async () => {
    // Créer une subscription J-7
    const dateJ7 = new Date();
    dateJ7.setDate(dateJ7.getDate() + 7);

    await prisma.subscription.create({
      data: {
        tenantId: tenantAId,
        planId: (await prisma.plan.findFirst())!.id,
        status: 'ACTIVE',
        endDate: dateJ7
      }
    });

    const sendSpy = jest.spyOn(smsService, 'sendSms');

    // Première exécution
    await service.sendExpirationReminders();
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // Deuxième exécution immédiate
    await service.sendExpirationReminders();
    expect(sendSpy).toHaveBeenCalledTimes(1); // Pas d'appel additionnel !

    sendSpy.mockRestore();
  });

  it('🟢 Test 3 : Un échec du provider SMS ne bloque pas l\'exécution globale du cron', async () => {
    // Créer une subscription J-1
    const dateJ1 = new Date();
    dateJ1.setDate(dateJ1.getDate() + 1);

    const sub = await prisma.subscription.create({
      data: {
        tenantId: tenantAId,
        planId: (await prisma.plan.findFirst())!.id,
        status: 'ACTIVE',
        endDate: dateJ1
      }
    });

    // Simuler une erreur fatale dans le service SMS
    const sendSpy = jest.spyOn(smsService, 'sendSms').mockRejectedValue(new Error('SMS Gateway Timeout'));

    // Le cron complet ne doit pas lever d'exception
    await expect(service.handleCron()).resolves.not.toThrow();

    // Le log d'échec doit être enregistré en base
    const log = await prisma.subscriptionReminderLog.findFirst({
      where: { subscriptionId: sub.id, reminderDays: 1 }
    });
    expect(log).toBeDefined();
    expect(log?.status).toBe('FAILED');
    expect(log?.errorMessage).toContain('SMS Gateway Timeout');

    sendSpy.mockRestore();
  });

  it('🔒 Test 4 : Isolation Tenant - Récupère le bon numéro de téléphone admin pour chaque tenant', async () => {
    // Créer des subs J-7 pour les deux tenants
    const dateJ7 = new Date();
    dateJ7.setDate(dateJ7.getDate() + 7);

    const planId = (await prisma.plan.findFirst())!.id;

    await prisma.subscription.create({
      data: { tenantId: tenantAId, planId, status: 'ACTIVE', endDate: dateJ7 }
    });

    await prisma.subscription.create({
      data: { tenantId: tenantBId, planId, status: 'ACTIVE', endDate: dateJ7 }
    });

    const sendSpy = jest.spyOn(smsService, 'sendSms');

    await service.sendExpirationReminders();

    // Doit avoir envoyé deux SMS différents aux deux admins correspondants
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(sendSpy.mock.calls.some(call => call[0] === '+221771112233' && call[1].includes('Tenant Reminder A'))).toBe(true);
    expect(sendSpy.mock.calls.some(call => call[0] === '+221774445566' && call[1].includes('Tenant Reminder B'))).toBe(true);

    sendSpy.mockRestore();
  });
});
