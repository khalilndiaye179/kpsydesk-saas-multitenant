import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
  create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    return this.usersService.create(createUserDto, req.user);
  }

  @Put(':id/role')
  @Roles(Role.ADMIN)
  updateRole(
    @Param('id') id: string,
    @Body('role') role: Role,
    @Req() req: any,
  ) {
    return this.usersService.updateRole(id, role, req.user);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: UpdateUserDto, @Req() req: any) {
    if (req.user.role === Role.USER && req.user.userId !== id) {
      throw new ForbiddenException("Vous n'êtes pas autorisé à modifier ce profil.");
    }
    // Un utilisateur simple ne peut pas modifier son propre rôle
    if (req.user.role === Role.USER && data.role) {
      delete data.role;
    }
    // Personne ne doit pouvoir forcer l'activation/désactivation du MFA via ce endpoint
    if ('mfaEnabled' in data) {
      delete (data as any).mfaEnabled;
    }
    return this.usersService.update(id, data, req.user);
  }

  @Post(':id/reset-mfa')
  @Roles(Role.ADMIN)
  resetMfa(@Param('id') id: string, @Req() req: any) {
    return this.usersService.resetMfa(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.usersService.remove(id, req.user);
  }
}
