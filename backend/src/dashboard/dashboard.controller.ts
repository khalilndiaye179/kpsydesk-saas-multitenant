import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { FeatureGuard } from '../tenant/feature.guard';
import { RequireFeature } from '../tenant/require-feature.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('treasury-summary')
  @RequireFeature('treasury_dashboard')
  async getTreasurySummary(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.tenantId;
    return this.dashboardService.getTreasurySummary(tenantId, startDate, endDate);
  }

  @Get('treasury-export-excel')
  @RequireFeature('treasury_dashboard')
  async exportExcel(
    @Req() req: any,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.tenantId;
    return this.dashboardService.exportExcel(res, tenantId, startDate, endDate);
  }

  @Get('treasury-export-pdf')
  @RequireFeature('treasury_dashboard')
  async exportPdf(
    @Req() req: any,
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.tenantId;
    const userName = req.user?.email || 'Utilisateur';
    return this.dashboardService.exportPdf(res, tenantId, startDate, endDate, userName);
  }
}
