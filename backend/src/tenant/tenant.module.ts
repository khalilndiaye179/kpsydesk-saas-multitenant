import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { SubscriptionsController } from './subscriptions.controller';
import { AdminTenantsController } from './admin-tenants.controller';
import { TenantGuard } from './tenant.guard';
import { QuotaGuard } from './quota.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';

import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { SmsNotificationService } from './sms-notification.service';

@Module({
  imports: [PrismaModule, AuthModule, MailModule],
  controllers: [TenantsController, SubscriptionsController, AdminTenantsController],
  providers: [TenantsService, TenantGuard, QuotaGuard, SubscriptionLifecycleService, SmsNotificationService],
  exports: [TenantsService, TenantGuard, QuotaGuard, SubscriptionLifecycleService, SmsNotificationService],
})
export class TenantModule {}

