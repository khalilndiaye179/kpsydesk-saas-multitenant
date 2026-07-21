import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvider } from '@prisma/client';

@Injectable()
export class PaymentPropagationService {
  private readonly logger = new Logger(PaymentPropagationService.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent('provider.activated')
  async handleProviderActivated(provider: PaymentProvider) {
    this.logger.log(`Propagating activated provider ${provider.code} to all tenants`);

    // Get all tenants
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    
    let createdCount = 0;
    for (const tenant of tenants) {
      // Check if this tenant already has a method for this provider
      const existing = await this.prisma.tenantPaymentMethod.findUnique({
        where: {
          tenantId_providerId: {
            tenantId: tenant.id,
            providerId: provider.id
          }
        }
      });

      if (!existing) {
        await this.prisma.tenantPaymentMethod.create({
          data: {
            tenantId: tenant.id,
            providerId: provider.id,
            tenantStatus: 'AVAILABLE',
            mode: 'AGGREGATOR'
          }
        });
        createdCount++;
      }
    }

    this.logger.log(`Propagated provider ${provider.code} to ${createdCount} tenants`);
  }

  /**
   * Called when a new tenant signs up, to give them access to all currently active providers
   */
  @OnEvent('tenant.created')
  async propagateToNewTenant(tenantId: string) {
    this.logger.log(`Propagating all active providers to new tenant ${tenantId}`);

    const activeProviders = await this.prisma.paymentProvider.findMany({
      where: {
        OR: [
          { globalStatus: 'ACTIVE' },
          { globalStatus: 'TEST' }
        ]
      }
    });

    let createdCount = 0;
    for (const provider of activeProviders) {
       await this.prisma.tenantPaymentMethod.create({
          data: {
            tenantId,
            providerId: provider.id,
            tenantStatus: 'AVAILABLE',
            mode: 'AGGREGATOR'
          }
        });
        createdCount++;
    }
    
    this.logger.log(`Propagated ${createdCount} providers to new tenant ${tenantId}`);
  }
}
