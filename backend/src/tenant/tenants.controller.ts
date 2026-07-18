import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from './tenant.guard';
import { Public } from '../auth/public.decorator';

/**
 * TenantsController — Routes liées à la gestion des tenants.
 *
 * Routes publiques (sans auth) :
 *  POST /api/tenants/signup   → Inscription d'un nouveau tenant
 *  GET  /api/tenants/plans    → Liste des plans disponibles (page Pricing)
 *
 * Routes protégées (auth JWT + tenant) :
 *  GET  /api/tenants/me       → Informations et usage du tenant courant
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Inscription publique d'un nouveau tenant.
   * Crée : Tenant + utilisateur Admin + Subscription en période d'essai.
   */
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body()
    body: {
      companyName: string;
      subdomain: string;
      adminEmail: string;
      adminPassword: string;
      adminFirstName: string;
      adminLastName: string;
      adminPhone: string;
      adminCountry: string;
      adminPosition: string;
      planName?: string;
    },
  ) {
    return this.tenantsService.signup(body);
  }

  /**
   * Liste publique des plans disponibles — utilisée par la page /pricing.
   */
  @Public()
  @Get('plans')
  getPlans() {
    return this.tenantsService.getPublicPlans();
  }

  /**
   * Retourne les informations du tenant courant + usage (actifs, utilisateurs).
   * Requiert : JWT valide + contexte tenant (header X-Tenant-ID ou sous-domaine).
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getMyTenant(@Req() req: { user: { tenantId?: string }; tenantId?: string }) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.tenantsService.getMyTenant(tenantId!);
  }

  /**
   * Retourne la liste des passerelles de paiement disponibles configurées par le super-admin.
   * Protégé pour n'exposer les moyens qu'aux tenants authentifiés.
   */
  @Get('payment-gateways')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getPaymentGateways() {
    return this.tenantsService.getAvailableGateways();
  }
}
