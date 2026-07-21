import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentCryptoService } from './payment-crypto.service';
import { PaymentProvidersRegistryService } from './payment-providers-registry.service';
import { CreatePaymentProviderDto, UpdatePaymentProviderDto, UpdateProviderStatusDto } from './dto/payment.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PaymentProvidersService {
  private readonly logger = new Logger(PaymentProvidersService.name);

  constructor(
    private prisma: PrismaService,
    private cryptoService: PaymentCryptoService,
    private registry: PaymentProvidersRegistryService,
    private eventEmitter: EventEmitter2,
  ) {}

  async listProviders(includeConfig = false) {
    const providers = await this.prisma.paymentProvider.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return providers.map(p => {
      const { configEncrypted, ...rest } = p;
      let config = null;
      if (includeConfig && configEncrypted) {
        try {
          config = this.cryptoService.decrypt(configEncrypted as string);
        } catch (e) {
          this.logger.error(`Failed to decrypt config for provider ${p.code}`);
        }
      }
      return { ...rest, config };
    });
  }

  async getProviderForAdmin(id: string) {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');

    let config = null;
    if (provider.configEncrypted) {
      config = this.cryptoService.decrypt(provider.configEncrypted as string);
    }

    const { configEncrypted, ...rest } = provider;
    return { ...rest, config };
  }

  async createProvider(dto: CreatePaymentProviderDto) {
    const existing = await this.prisma.paymentProvider.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException(`Provider with code ${dto.code} already exists`);
    }

    let configEncrypted = null;
    if (dto.config) {
      configEncrypted = this.cryptoService.encrypt(dto.config);
    }

    const provider = await this.prisma.paymentProvider.create({
      data: {
        code: dto.code,
        displayName: dto.displayName,
        logoUrl: dto.logoUrl,
        description: dto.description,
        environment: dto.environment,
        currency: dto.currency,
        feePercent: dto.feePercent,
        settlementDays: dto.settlementDays,
        configEncrypted,
      },
    });

    await this.auditLog(provider.id, 'CREATE', 'SuperAdmin', null, { ...dto, config: '[REDACTED]' });

    return this.getProviderForAdmin(provider.id);
  }

  async updateProvider(id: string, dto: UpdatePaymentProviderDto) {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');

    const updateData: any = { ...dto };
    delete updateData.config;
    delete updateData.performedBy;

    if (dto.config !== undefined) {
      updateData.configEncrypted = dto.config ? this.cryptoService.encrypt(dto.config) : null;
    }

    const updated = await this.prisma.paymentProvider.update({
      where: { id },
      data: updateData,
    });

    await this.auditLog(
      id, 
      'UPDATE', 
      dto.performedBy || 'SuperAdmin', 
      { ...provider, configEncrypted: '[REDACTED]' }, 
      { ...updated, configEncrypted: '[REDACTED]' }
    );

    return this.getProviderForAdmin(id);
  }

  async toggleStatus(id: string, dto: UpdateProviderStatusDto) {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');

    const updated = await this.prisma.paymentProvider.update({
      where: { id },
      data: { 
        globalStatus: dto.status,
        publishedAt: dto.status === 'ACTIVE' && !provider.publishedAt ? new Date() : provider.publishedAt
      },
    });

    await this.auditLog(id, 'STATUS_CHANGE', dto.performedBy || 'SuperAdmin', { globalStatus: provider.globalStatus }, { globalStatus: updated.globalStatus });

    if (dto.status === 'ACTIVE') {
      this.eventEmitter.emit('provider.activated', updated);
    }

    return updated;
  }

  async testConnection(id: string) {
    const provider = await this.getProviderForAdmin(id);
    if (!provider) throw new NotFoundException('Provider not found');

    const adapter = this.registry.getAdapter(provider.code);
    return await adapter.testConnection(provider.config || {}, provider.environment === 'SANDBOX');
  }

  async getAuditLogs(id: string) {
    return this.prisma.providerAuditLog.findMany({
      where: { providerId: id },
      orderBy: { createdAt: 'desc' }
    });
  }

  private async auditLog(providerId: string, action: string, performedBy: string, oldConfig: any, newConfig: any) {
    await this.prisma.providerAuditLog.create({
      data: {
        providerId,
        action,
        performedBy,
        oldConfig: oldConfig || {},
        newConfig: newConfig || {},
      }
    });
  }
}
