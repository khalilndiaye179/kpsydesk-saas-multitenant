import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * UsersController — CRUD des utilisateurs d'un tenant.
 *
 * 🔒 Toutes les routes requièrent :
 *   1. Un token JWT valide (JwtAuthGuard)
 *   2. Que le tenant du JWT correspond au tenant de la requête (TenantGuard)
 *   3. Des droits correspondants (RolesGuard)
 */
@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    if (req.user.role === Role.USER && req.user.userId !== id) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à voir ce profil.");
    }
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createUserDto: any) {
    return this.usersService.create(createUserDto);
  }

  @Put(':id/role')
  @Roles(Role.ADMIN)
  updateRole(
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    return this.usersService.updateRole(id, role);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    if (req.user.role === Role.USER && req.user.userId !== id) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à modifier ce profil.");
    }
    // Un utilisateur simple ne peut pas modifier son propre rôle
    if (req.user.role === Role.USER && data.role) {
      delete data.role;
    }
    return this.usersService.update(id, data);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
