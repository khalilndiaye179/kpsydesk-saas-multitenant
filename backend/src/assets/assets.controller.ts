import { Controller, Get, Post, Body, Param, Put, Delete, Res, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetStatus, Role } from '@prisma/client';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { Public } from '../auth/public.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { EnrollAssetDto } from './dto/enroll-asset.dto';

/**
 * AssetsController — CRUD des équipements.
 *
 * 🔒 Toutes les routes sauf /enroll et /agent/download requièrent :
 *   1. Un token JWT valide (JwtAuthGuard)
 *   2. Que le tenant du JWT correspond au tenant de la requête (TenantGuard)
 *   3. Des droits correspondants (RolesGuard)
 *
 * /enroll et /agent/download utilisent @Public() pour bypasser ces guards globaux.
 */
@Controller('assets')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  findAll(@Req() req: any) {
    if (req.user.role === Role.USER) {
      return this.assetsService.findAllForUser(req.user.userId);
    }
    return this.assetsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const asset = await this.assetsService.findOne(id);
    if (req.user.role === Role.USER && asset.userId !== req.user.userId) {
      throw new ForbiddenException("Vous n'avez pas accès à cet équipement.");
    }
    return asset;
  }

  /**
   * Route publique — appelée par l'agent Windows sans token JWT.
   * Le tenant est identifié via le header X-Tenant-ID ou le sous-domaine.
   */
  @Post('enroll')
  @Public() // Bypass JwtAuthGuard, TenantGuard et RolesGuard
  enroll(@Body() data: EnrollAssetDto) {
    return this.assetsService.enroll(data);
  }

  /**
   * Téléchargement de l'agent Windows — public.
   */
  @Get('agent/download')
  @Public() // Bypass JwtAuthGuard, TenantGuard et RolesGuard
  downloadAgent(@Res() res: Response) {
    const searchPaths = [
      path.join(process.cwd(), 'src', 'assets', 'agent.msi'),
      path.join(process.cwd(), 'dist', 'src', 'assets', 'agent.msi'),
      path.join(process.cwd(), 'dist', 'assets', 'agent.msi'),
      path.join(__dirname, 'agent.msi')
    ];

    let foundPath = '';
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) {
      return res.status(404).send("Le fichier d'installation de l'agent (agent.msi) n'a pas encore été généré sur le serveur.");
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=KPsyITAgent.msi');
    return res.sendFile(foundPath);
  }

  @Post()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.create(createAssetDto);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  update(@Param('id') id: string, @Body() data: UpdateAssetDto) {
    return this.assetsService.update(id, data);
  }

  @Put(':id/status')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: AssetStatus,
    @Body('reason') reason?: string,
  ) {
    return this.assetsService.updateStatus(id, status, reason);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }
}
