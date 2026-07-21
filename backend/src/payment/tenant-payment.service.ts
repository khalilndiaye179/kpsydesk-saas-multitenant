import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentCryptoService } from './payment-crypto.service';
import { ConfigureTenantPaymentMethodDto, UpdateTenantPaymentMethodDto } from './dto/payment.dto';

@Injectable()
export class TenantPaymentService {
  private readonly logger = new Logger(TenantPaymentService.name);

  constructor(
    private prisma: PrismaService,
    private cryptoService: PaymentCryptoService,
  ) {}

  async getAvailableForTenant(tenantId: string) {
    // Get all methods for this tenant
    const methods = await this.prisma.tenantPaymentMethod.findMany({
      where: { tenantId },
      include: {
        provider: {
          select: {
            id: true,
            code: true,
            displayName: true,
            logoUrl: true,
            description: true,
            globalStatus: true,
            environment: true,
            currency: true,
            feePercent: true
          }
        }
      }
    });

    // Only return methods where the global provider is ACTIVE or TEST
    return methods
      .filter(m => m.provider.globalStatus === 'ACTIVE' || m.provider.globalStatus === 'TEST')
      .map(m => {
        let tenantConfig = null;
        if (m.tenantConfigEncrypted) {
           try {
             tenantConfig = this.cryptoService.decrypt(m.tenantConfigEncrypted as string);
           } catch (e) {
             this.logger.error(`Failed to decrypt tenant config for tenant ${tenantId} and provider ${m.providerId}`);
           }
        }
        
        const { tenantConfigEncrypted, ...rest } = m;
        return { ...rest, tenantConfig };
      });
  }

  async updateTenantStatus(tenantId: string, id: string, dto: UpdateTenantPaymentMethodDto) {
    const method = await this.prisma.tenantPaymentMethod.findUnique({
      where: { id },
      include: { provider: true }
    });

    if (!method || method.tenantId !== tenantId) {
      throw new NotFoundException('Payment method not found for this tenant');
    }

    if (dto.tenantStatus === 'ACTIVE' && method.provider.globalStatus === 'INACTIVE') {
      throw new Error('Cannot activate a payment method that is globally inactive');
    }

    return this.prisma.tenantPaymentMethod.update({
      where: { id },
      data: { 
        tenantStatus: dto.tenantStatus,
        activatedAt: dto.tenantStatus === 'ACTIVE' && !method.activatedAt ? new Date() : method.activatedAt
      }
    });
  }

  async configureTenantMethod(tenantId: string, id: string, dto: ConfigureTenantPaymentMethodDto) {
    const method = await this.prisma.tenantPaymentMethod.findUnique({
      where: { id }
    });

    if (!method || method.tenantId !== tenantId) {
      throw new NotFoundException('Payment method not found for this tenant');
    }

    let tenantConfigEncrypted = null;
    if (dto.tenantConfig) {
      tenantConfigEncrypted = this.cryptoService.encrypt(dto.tenantConfig);
    }

    return this.prisma.tenantPaymentMethod.update({
      where: { id },
      data: {
        mode: dto.mode,
        tenantConfigEncrypted: dto.tenantConfig ? tenantConfigEncrypted : method.tenantConfigEncrypted
      }
    });
  }
}
