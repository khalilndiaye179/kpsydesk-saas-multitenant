import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FeatureGuard } from '../tenant/feature.guard';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService, FeatureGuard],
  exports: [DashboardService, FeatureGuard],
})
export class DashboardModule {}
