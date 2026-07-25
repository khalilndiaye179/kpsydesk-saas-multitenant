import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('Health Checks', () => {
  let controller: HealthController;
  let service: HealthService;
  let mockPrisma: any;
  let mockMail: any;

  beforeEach(async () => {
    // Mock de PrismaService
    mockPrisma = {
      $queryRaw: jest.fn(),
    };

    // Mock de MailService
    mockMail = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  describe('checkDatabase', () => {
    it('should return true when database is healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([1]);
      const res = await service.checkDatabase();
      expect(res).toBe(true);
    });

    it('should return false when database query throws error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection lost'));
      const res = await service.checkDatabase();
      expect(res).toBe(false);
    });
  });

  describe('getHealth (Controller)', () => {
    it('should return ok status when healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([1]);
      const res = await controller.getHealth();
      expect(res.status).toBe('ok');
      expect(res.timestamp).toBeDefined();
    });

    it('should throw ServiceUnavailableException when unhealthy', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB Down'));
      await expect(controller.getHealth()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('monitorHealth (Service Scheduler)', () => {
    beforeEach(() => {
      process.env.ALERT_EMAIL = 'admin@example.com';
      process.env.ALERT_THRESHOLD = '3';
    });

    afterEach(() => {
      delete process.env.ALERT_EMAIL;
      delete process.env.ALERT_THRESHOLD;
    });

    it('should increment failure count and trigger alert email at threshold', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failure'));

      // 1ère panne
      await service.monitorHealth();
      expect(service.getFailureCount()).toBe(1);
      expect(mockMail.sendMail).not.toHaveBeenCalled();

      // 2ème panne
      await service.monitorHealth();
      expect(service.getFailureCount()).toBe(2);
      expect(mockMail.sendMail).not.toHaveBeenCalled();

      // 3ème panne (atteint le seuil)
      await service.monitorHealth();
      expect(service.getFailureCount()).toBe(3);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);
      expect(service.getIsAlertSent()).toBe(true);

      // 4ème panne (bloqué par l'anti-spam : pas d'autre email)
      await service.monitorHealth();
      expect(service.getFailureCount()).toBe(4);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1); // Reste à 1
    });

    it('should send resolution email and reset counts when base goes back online', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failure'));

      // Simuler l'alerte envoyée
      await service.monitorHealth(); // 1
      await service.monitorHealth(); // 2
      await service.monitorHealth(); // 3 (email d'alerte)
      expect(service.getIsAlertSent()).toBe(true);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(1);

      // Rétablir la base de données
      mockPrisma.$queryRaw.mockResolvedValue([1]);

      // Appel de surveillance -> retour à la normale
      await service.monitorHealth();
      expect(service.getFailureCount()).toBe(0);
      expect(service.getIsAlertSent()).toBe(false);
      expect(mockMail.sendMail).toHaveBeenCalledTimes(2); // Alerte + Résolution
      expect(mockMail.sendMail).toHaveBeenLastCalledWith(
        'admin@example.com',
        expect.stringContaining('RÉSOLU'),
        expect.any(String),
        expect.any(String),
      );
    });
  });
});
