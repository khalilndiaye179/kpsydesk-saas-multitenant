import { Controller, Get, Post, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';

@Controller('payroll')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('simulation/:userId')
  async getSimulation(@Param('userId') userId: string, @Req() req: any) {
    // Un simple utilisateur ne peut simuler que sa propre fiche de paie
    if (req.user.role !== Role.ADMIN && req.user.userId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès aux informations salariales de ce collaborateur.");
    }
    return this.payrollService.getSimulation(userId);
  }

  @Get('config')
  async getHrConfig(@Req() req: any) {
    if (req.user.role !== Role.ADMIN) {
      throw new ForbiddenException("Seuls les administrateurs peuvent consulter la configuration RH.");
    }
    return this.payrollService.getHrConfig();
  }

  @Post('config')
  async updateHrConfig(@Req() req: any, @Body() body: any) {
    if (req.user.role !== Role.ADMIN) {
      throw new ForbiddenException("Seuls les administrateurs peuvent modifier la configuration RH.");
    }
    return this.payrollService.updateHrConfig(body);
  }
}
