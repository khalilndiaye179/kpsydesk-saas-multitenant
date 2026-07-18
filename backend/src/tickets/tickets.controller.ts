import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

/**
 * TicketsController — CRUD des tickets de support.
 *
 * 🔒 Toutes les routes requièrent :
 *   1. Un token JWT valide (JwtAuthGuard)
 *   2. Que le tenant du JWT correspond au tenant de la requête (TenantGuard)
 *   3. Des droits correspondants (RolesGuard)
 */
@Controller('tickets')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@Req() req: any) {
    if (req.user.role === Role.USER) {
      return this.ticketsService.findAllForUser(req.user.userId);
    }
    return this.ticketsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const ticket = await this.ticketsService.findOne(id);
    if (req.user.role === Role.USER && ticket.creatorId !== req.user.userId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce ticket.");
    }
    return ticket;
  }

  @Post()
  create(@Body() createTicketDto: CreateTicketDto, @Req() req: any) {
    if (req.user.role === Role.USER) {
      createTicketDto.creatorId = req.user.userId;
    }
    return this.ticketsService.create(createTicketDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: UpdateTicketDto, @Req() req: any) {
    const ticket = await this.ticketsService.findOne(id);
    if (req.user.role === Role.USER && ticket.creatorId !== req.user.userId) {
      throw new ForbiddenException("Vous n'avez pas l'autorisation de modifier ce ticket.");
    }
    return this.ticketsService.update(id, data);
  }

  @Put(':id/status')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.ticketsService.updateStatus(id, status);
  }

  @Put(':id/assign')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  assign(
    @Param('id') id: string,
    @Body('assigneeId') assigneeId: string,
  ) {
    return this.ticketsService.assign(id, assigneeId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.ticketsService.remove(id);
  }
}
