import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { SubscriptionsController } from './subscriptions.controller';
import { AdminTenantsController } from './admin-tenants.controller';
import { TenantGuard } from './tenant.guard';
import { QuotaGuard } from './quota.guard';
import { PrismaModule } from '../prisma/prisma.module';

import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

@Module({
  imports: [PrismaModule],
  controllers: [TenantsController, SubscriptionsController, AdminTenantsController],
  providers: [TenantsService, TenantGuard, QuotaGuard, SubscriptionLifecycleService],
  exports: [TenantsService, TenantGuard, QuotaGuard, SubscriptionLifecycleService],
})
export class TenantModule {}
