import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { tenantStorage } from './tenant.context';

/**
 * TenantMiddleware — appliqué globalement à toutes les routes /api/*.
 *
 * Stratégie de résolution du tenant :
 *  1. Header HTTP `X-Tenant-ID` (en mode développement ou pour l'agent Windows)
 *  2. Sous-domaine de l'Host HTTP (ex: acme-corp.kpsy.com → "acme-corp")
 *
 * ⚠️ SÉCURITÉ : Le tenantId est résolu UNIQUEMENT depuis le sous-domaine ou
 * le header X-Tenant-ID. Le JWT n'est PAS décodé ici car le middleware ne peut
 * pas vérifier la signature cryptographique — cette vérification est déléguée à
 * JwtAuthGuard. La cohérence JWT/tenant est ensuite vérifiée par TenantGuard.
 *
 * Décodage JWT sans vérification = vecteur d'attaque : un token forgé à la main
 * avec un tenantId arbitraire serait accepté par le middleware avant d'être
 * rejeté par Passport, mais le contexte ALS aurait déjà été corrompu.
 *
 * Si aucun tenant n'est résolu (route publique /signup, /pricing),
 * la requête continue sans contexte tenant — PrismaService laissera passer.
 *
 * Si le tenant est trouvé mais SUSPENDU ou ANNULÉ, la requête est bloquée (403).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request & { tenantId?: string; tenantSubdomain?: string }, res: Response, next: NextFunction) {
    let resolvedTenantId: string | undefined = undefined;
    let resolvedSubdomain: string | undefined = undefined;

    // Résoudre le tenant depuis le sous-domaine ou le header X-Tenant-ID.
    // La résolution depuis le JWT est INTENTIONNELLEMENT absente : sans vérification
    // de signature, un attaquant pourrait forger un tenantId arbitraire.
    const subdomain = this._resolveSubdomain(req);
    if (subdomain && subdomain !== 'legacy') {
      const tenant = await this.prisma.tenant.findFirst({
        where: { subdomain },
        select: { id: true, status: true, subdomain: true },
      });

      if (tenant) {
        const isSuspendedOrCancelled = tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED';
        const isBypassRoute = 
          req.path.includes('/subscriptions') || 
          req.path.includes('/tenants/me') || 
          req.path.includes('/tenants/plans') || 
          req.path.includes('/tenants/payment-gateways') || 
          req.path.includes('/auth/logout');

        if (isSuspendedOrCancelled && !isBypassRoute) {
          res.status(403).json({
            statusCode: 403,
            message: `Le tenant "${subdomain}" est ${tenant.status === 'SUSPENDED' ? 'suspendu' : 'annulé'}.`,
            status: tenant.status,
          });
          return;
        }
        resolvedTenantId = tenant.id;
        resolvedSubdomain = tenant.subdomain;
      }
    }

    if (!resolvedTenantId) {
      // Pas de tenant résolu → route publique / admin legacy
      return next();
    }

    // Stocker dans la requête pour les guards/décorateurs NestJS
    req.tenantId = resolvedTenantId;
    req.tenantSubdomain = resolvedSubdomain;

    // Assigner à l'AsyncLocalStorage pour que PrismaService filtre automatiquement
    tenantStorage.run({ tenantId: resolvedTenantId, subdomain: resolvedSubdomain || 'unknown' }, () => {
      next();
    });
  }

  /**
   * Détermine le sous-domaine depuis :
   * 1. Header X-Tenant-ID (dev / agent Windows)
   * 2. Sous-domaine HTTP (production)
   */
  private _resolveSubdomain(req: Request): string | undefined {
    // 1. Header explicite (développement / agent)
    const headerTenant = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenant?.trim()) {
      return headerTenant.trim().toLowerCase();
    }

    // 2. Sous-domaine HTTP
    const host = req.headers.host ?? '';
    // Retirer le port éventuel : "acme.inventaire-parc.com:3010" → "acme.inventaire-parc.com"
    const hostWithoutPort = host.split(':')[0];
    const parts = hostWithoutPort.split('.');

    // Un sous-domaine valide nécessite au moins 3 segments : sub.domain.tld
    if (parts.length >= 3) {
      const sub = parts[0];
      // Exclure "www" et "localhost" comme sous-domaines
      if (sub !== 'www' && sub !== 'localhost') {
        return sub.toLowerCase();
      }
    }

    return undefined;
  }
}
