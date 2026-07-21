import { Test, TestingModule } from '@nestjs/testing';
import { PaymentPropagationService } from './payment-propagation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentPropagationService', () => {
  let service: PaymentPropagationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentPropagationService,
        {
          provide: PrismaService,
          useValue: {
            paymentProvider: {
              findMany: jest.fn().mockResolvedValue([
                { id: 'provider-1', code: 'WAVE', environment: 'SANDBOX' },
              ]),
            },
            tenantPaymentMethod: {
              create: jest.fn().mockResolvedValue({}),
            },
            tenant: {
              findMany: jest.fn().mockResolvedValue([]),
            }
          },
        },
      ],
    }).compile();

    service = module.get<PaymentPropagationService>(PaymentPropagationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should propagate global providers to a new tenant', async () => {
    await service.propagateToNewTenant('tenant-123');

    expect(prisma.paymentProvider.findMany).toHaveBeenCalledWith({
      where: { 
        OR: [
          { globalStatus: 'ACTIVE' },
          { globalStatus: 'TEST' }
        ]
      },
    });
    
    expect(prisma.tenantPaymentMethod.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-123',
        providerId: 'provider-1',
        providerCode: 'WAVE',
        status: 'INACTIVE',
        environment: 'SANDBOX',
        configOverrides: {},
      },
    });
  });
});
