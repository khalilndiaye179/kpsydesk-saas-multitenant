import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { TenantInvoicesService } from './tenant-invoices.service';
import { CreateTenantInvoiceDto } from './dto/create-tenant-invoice.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { TenantPdfGenerator } from './tenant-pdf-generator';

@Controller('tenant-invoices')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TenantInvoicesController {
  constructor(private readonly invoicesService: TenantInvoicesService) {}

  @Get()
  async findAll(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.invoicesService.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.invoicesService.findOne(id, tenantId);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const tenantId = req.user.tenantId;
    const invoice = await this.invoicesService.findOne(id, tenantId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Facture_${invoice.invoiceNo}.pdf`);
    
    return TenantPdfGenerator.generatePdf(res, invoice);
  }

  @Post()
  async create(@Req() req: any, @Body() data: CreateTenantInvoiceDto) {
    const tenantId = req.user.tenantId;
    return this.invoicesService.create(tenantId, data);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body('status') status: string
  ) {
    const tenantId = req.user.tenantId;
    return this.invoicesService.updateStatus(id, tenantId, status);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.invoicesService.remove(id, tenantId);
  }
}
