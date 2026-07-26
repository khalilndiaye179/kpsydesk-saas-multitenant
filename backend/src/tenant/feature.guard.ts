import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRE_FEATURE_KEY } from './require-feature.decorator';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<string>(
      REQUIRE_FEATURE_KEY,
      context.getHandler(),
    );

    // Si aucun gating de feature n'est configuré sur la route, on autorise
    if (!featureKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      tenantId?: string;
    }>();

    const tenantId = request.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        "Accès refusé : Contexte d'organisation manquant pour cette fonctionnalité.",
      );
    }

    // Récupérer le tenant, son plan de base, et son abonnement actif
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new ForbiddenException('Organisation introuvable.');
    }

    // Récupérer les fonctionnalités activées
    const activeSubscription = tenant.subscriptions[0];
    const featuresIncluded = (activeSubscription?.plan?.featuresIncluded || 
                             tenant.plan?.featuresIncluded || 
                             {}) as Record<string, any>;

    // Vérifier si la fonctionnalité est explicitement activée (true)
    if (featuresIncluded[featureKey] !== true) {
      throw new ForbiddenException(
        `Accès refusé : Cette fonctionnalité (${featureKey}) n'est pas incluse dans votre plan actuel. Veuillez contacter le support pour mettre à jour votre abonnement.`
      );
    }

    return true;
  }
}
