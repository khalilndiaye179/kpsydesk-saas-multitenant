import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from './tenant.context';

/** Clé de métadonnée pour indiquer la ressource à contrôler */
export const QUOTA_RESOURCE_KEY = 'quotaResource';

/**
 * Décorateur à placer sur les endpoints de création de ressources.
 * Ex: @CheckQuota('asset') ou @CheckQuota('user')
 */
export const CheckQuota = (resource: 'asset' | 'user') =>
  SetMetadata(QUOTA_RESOURCE_KEY, resource);

/**
 * QuotaGuard — bloque la création de ressources si le quota du plan est atteint.
 *
 * Doit être utilisé avec le décorateur @CheckQuota() sur les endpoints POST.
 * La vérification est faite dans la base de données (count réel) pour être exacte.
 *
 * Exemple d'utilisation :
 * @Post()
 * @UseGuards(JwtAuthGuard, TenantGuard, QuotaGuard)
 * @CheckQuota('asset')
 * create(@Body() dto: any) { ... }
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>(QUOTA_RESOURCE_KEY, context.getHandler());

    // Pas de ressource déclarée → le guard laisse passer
    if (!resource) return true;

    const tenantId = TenantContext.getTenantId();
    if (!tenantId) return true; // Route publique, pas de restriction

    // Récupérer l'abonnement actif du tenant
    // Note: on requête directement avec tenantId explicite (hors filtre ALS pour Subscription)
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: { plan: true },
    });

    if (!subscription) {
      throw new ForbiddenException(
        'Aucun abonnement actif. Veuillez souscrire à un plan.',
      );
    }

    // Quota actifs : peut être surchargé au niveau de la subscription
    const quotaAssets =
      subscription.quotaAssets ?? subscription.plan.quotaAssets;

    if (resource === 'asset') {
      // Compter les actifs du tenant via une requête directe (bypass ALS pour count précis)
      const count = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Asset" WHERE "tenantId" = ${tenantId}
      `;
      const current = Number(count[0].count);

      if (current >= quotaAssets) {
        throw new ForbiddenException(
          `Quota d'actifs atteint (${current}/${quotaAssets}). Passez à un plan supérieur dans "Mon abonnement".`,
        );
      }
    }

    if (resource === 'user') {
      const quotaUsers = subscription.plan.quotaUsers;
      const count = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "User" WHERE "tenantId" = ${tenantId}
      `;
      const current = Number(count[0].count);

      if (current >= quotaUsers) {
        throw new ForbiddenException(
          `Quota d'utilisateurs atteint (${current}/${quotaUsers}). Passez à un plan supérieur dans "Mon abonnement".`,
        );
      }
    }

    return true;
  }
}
