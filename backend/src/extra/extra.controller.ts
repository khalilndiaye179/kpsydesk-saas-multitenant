import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ExtraService } from './extra.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';

/**
 * ExtraController — CRUD générique pour toutes les entités métier secondaires.
 * (licences, départements, emplacements, contrats, fournisseurs, mouvements, etc.)
 *
 * 🔒 Toutes les routes requièrent :
 *   1. Un token JWT valide (JwtAuthGuard)
 *   2. Que le tenant du JWT corresponds au tenant de la requête (TenantGuard)
 *   3. Des droits correspondants (RolesGuard)
 */
@Controller(':entity(licenses|onboardings|maintenances|locations|consumables|suppliers|orders|contracts|sales|kb|movements|audit-logs|departments|depreciations)')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ExtraController {
  constructor(private service: ExtraService) {}

  @Get()
  findAll(@Param('entity') entity: string, @Req() req: any) {
    const isUser = req.user.role === Role.USER;
    const isAdmin = req.user.role === Role.ADMIN;

    if (isUser && entity !== 'kb') {
      throw new ForbiddenException("Accès refusé : privilèges insuffisants.");
    }
    if ((entity === 'audit-logs' || entity === 'depreciations') && !isAdmin) {
      throw new ForbiddenException("Accès refusé : administration requise.");
    }
    return this.service.findAll(entity);
  }

  @Get(':id')
  findOne(@Param('entity') entity: string, @Param('id') id: string, @Req() req: any) {
    const isUser = req.user.role === Role.USER;
    const isAdmin = req.user.role === Role.ADMIN;

    if (isUser && entity !== 'kb') {
      throw new ForbiddenException("Accès refusé : privilèges insuffisants.");
    }
    if ((entity === 'audit-logs' || entity === 'depreciations') && !isAdmin) {
      throw new ForbiddenException("Accès refusé : administration requise.");
    }
    return this.service.findOne(entity, id);
  }

  @Post()
  create(@Param('entity') entity: string, @Req() req: any) {
    const body = req.body;
    const isUser = req.user.role === Role.USER;
    const isAdmin = req.user.role === Role.ADMIN;

    if (isUser) {
      throw new ForbiddenException("Accès refusé : privilèges insuffisants.");
    }
    if ((entity === 'audit-logs' || entity === 'depreciations') && !isAdmin) {
      throw new ForbiddenException("Accès refusé : administration requise.");
    }
    return this.service.create(entity, body);
  }

  @Put(':id')
  update(@Param('entity') entity: string, @Param('id') id: string, @Req() req: any) {
    const body = req.body;
    const isUser = req.user.role === Role.USER;
    const isAdmin = req.user.role === Role.ADMIN;

    if (isUser) {
      throw new ForbiddenException("Accès refusé : privilèges insuffisants.");
    }
    if ((entity === 'audit-logs' || entity === 'depreciations') && !isAdmin) {
      throw new ForbiddenException("Accès refusé : administration requise.");
    }
    return this.service.update(entity, id, body);
  }

  @Delete(':id')
  remove(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Query('performedBy') performedBy?: string,
    @Req() req?: any
  ) {
    const isUser = req.user.role === Role.USER;
    const isAdmin = req.user.role === Role.ADMIN;

    if (isUser) {
      throw new ForbiddenException("Accès refusé : privilèges insuffisants.");
    }

    if (entity.toLowerCase() === 'audit-logs' && id.toLowerCase() === 'clear') {
      if (!isAdmin) {
        throw new ForbiddenException("Accès refusé : administration requise.");
      }
      return this.service.clearAuditLogs();
    }

    if ((entity === 'audit-logs' || entity === 'depreciations') && !isAdmin) {
      throw new ForbiddenException("Accès refusé : administration requise.");
    }

    return this.service.remove(entity, id, performedBy);
  }
}
