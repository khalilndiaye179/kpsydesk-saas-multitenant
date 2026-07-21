import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentProvidersService } from './payment-providers.service';
import { CreatePaymentProviderDto, UpdatePaymentProviderDto, UpdateProviderStatusDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin-tenants/payment-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PaymentProvidersController {
  constructor(private readonly service: PaymentProvidersService) {}

  @Get()
  async list() {
    return this.service.listProviders(true); // Super admin sees config
  }

  @Post()
  async create(@Body() dto: CreatePaymentProviderDto) {
    return this.service.createProvider(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePaymentProviderDto) {
    return this.service.updateProvider(id, dto);
  }

  @Put(':id/status')
  async toggleStatus(@Param('id') id: string, @Body() dto: UpdateProviderStatusDto) {
    return this.service.toggleStatus(id, dto);
  }

  @Post(':id/test')
  async testConnection(@Param('id') id: string) {
    return this.service.testConnection(id);
  }

  @Get(':id/audit-logs')
  async getAuditLogs(@Param('id') id: string) {
    return this.service.getAuditLogs(id);
  }
}
