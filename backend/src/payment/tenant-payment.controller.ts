import { Controller, Get, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { TenantPaymentService } from './tenant-payment.service';
import { ConfigureTenantPaymentMethodDto, UpdateTenantPaymentMethodDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('tenant-payment/methods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TenantPaymentController {
  constructor(private readonly service: TenantPaymentService) {}

  @Get()
  async list(@Req() req) {
    return this.service.getAvailableForTenant(req.user.tenantId);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateTenantPaymentMethodDto, @Req() req) {
    return this.service.updateTenantStatus(req.user.tenantId, id, dto);
  }

  @Put(':id/config')
  async configure(@Param('id') id: string, @Body() dto: ConfigureTenantPaymentMethodDto, @Req() req) {
    return this.service.configureTenantMethod(req.user.tenantId, id, dto);
  }
}
