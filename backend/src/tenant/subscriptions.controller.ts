import {
  Controller,
  Post,
  Delete,
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
 * SubscriptionsController — Gestion de l'abonnement du tenant courant.
 *
 * Toutes les routes nécessitent une authentification JWT valide.
 * (Sauf webhook de paiement publique).
 *
 *  POST   /api/subscriptions/upgrade   → Changer de plan
 *  DELETE /api/subscriptions/cancel    → Annuler l'abonnement
 *  POST   /api/subscriptions/webhook   → Validation paiement (MM / Wave)
 */
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SubscriptionsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Webhook de confirmation de paiement.
   * Reçoit le statut du paiement pour un tenant donné et met à jour l'abonnement.
   */
  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  webhook(
    @Body() body: { tenantId: string; status: 'success' | 'failed' },
  ) {
    return this.tenantsService.confirmPayment(body.tenantId, body.status);
  }

  /**
   * Upgrade ou downgrade vers un autre plan.
   * Body: { planName: string }
   */
  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  upgrade(
    @Body() body: { planName: string; billingInterval?: string },
    @Req() req: { tenantId?: string; user?: { tenantId?: string } },
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.tenantsService.updateSubscription(tenantId!, body);
  }

  /**
   * Annule l'abonnement actif.
   * Le tenant reste accessible jusqu'à la fin de la période payée.
   */
  @Delete('cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Req() req: { tenantId?: string; user?: { tenantId?: string } },
  ) {
    const tenantId = req.tenantId ?? req.user?.tenantId;
    return this.tenantsService.cancelSubscription(tenantId!);
  }
}
