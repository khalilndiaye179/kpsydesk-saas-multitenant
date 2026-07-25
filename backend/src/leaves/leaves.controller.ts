import { Controller, Get, Post, Body, Param, Patch, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';

@Controller('leaves')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get()
  async findAll(@Req() req: any) {
    if (req.user.role === Role.ADMIN) {
      return this.leavesService.findAll();
    }
    return this.leavesService.findAllForUser(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const request = await this.leavesService.findOne(id);
    if (req.user.role !== Role.ADMIN && request.userId !== req.user.userId) {
      throw new ForbiddenException("Vous n'avez pas accès à cette demande de congé.");
    }
    return request;
  }

  @Post()
  async create(@Req() req: any, @Body() body: { type: string; startDate: string; endDate: string; reason?: string }) {
    return this.leavesService.create(req.user.userId, body);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { status: string; rejectionReason?: string }
  ) {
    if (req.user.role !== Role.ADMIN) {
      throw new ForbiddenException("Seuls les administrateurs peuvent valider ou refuser des congés.");
    }
    return this.leavesService.updateStatus(id, req.user.userId, body.status, body.rejectionReason);
  }
}
