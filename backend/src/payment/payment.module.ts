import { Module } from '@nestjs/common';
import { PaymentCryptoService } from './payment-crypto.service';
import { WaveAdapter } from './providers/wave.adapter';
import { OrangeMoneyAdapter } from './providers/orange-money.adapter';
import { PaymentProvidersRegistryService } from './payment-providers-registry.service';
import { PaymentProvidersService } from './payment-providers.service';
import { TenantPaymentService } from './tenant-payment.service';
import { PaymentPropagationService } from './payment-propagation.service';
import { PaymentProvidersController } from './payment-providers.controller';
import { TenantPaymentController } from './tenant-payment.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    PaymentProvidersController,
    TenantPaymentController
  ],
  providers: [
    PaymentCryptoService,
    WaveAdapter,
    OrangeMoneyAdapter,
    PaymentProvidersRegistryService,
    PaymentProvidersService,
    TenantPaymentService,
    PaymentPropagationService
  ],
  exports: [
    PaymentPropagationService
  ]
})
export class PaymentModule {}
