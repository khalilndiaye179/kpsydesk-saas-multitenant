import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';

/**
 * TenantGuard — à appliquer après JwtAuthGuard sur toutes les routes protégées.
 *
 * Vérifie que l'utilisateur authentifié (via JWT) appartient bien au tenant
 * résolu par le TenantMiddleware depuis la requête courante.
 *
 * Supporte le décorateur @Public() pour bypasser la vérification.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { userId: string; email: string; role: string; tenantId?: string };
      tenantId?: string;
    }>();

    const requestTenantId = request.tenantId; // posé par TenantMiddleware
    const user = request.user;                 // posé par JwtAuthGuard

    if (!user) {
      throw new UnauthorizedException('Authentification requise.');
    }

    // ⚠️ SÉCURITÉ : On ne laisse plus passer les requêtes sans contexte tenant pour un utilisateur tenant
    if (user.tenantId) {
      if (!requestTenantId) {
        throw new ForbiddenException(
          'Accès refusé : Contexte de l\'organisation manquant ou invalide.',
        );
      }
      if (user.tenantId !== requestTenantId) {
        throw new ForbiddenException(
          'Accès refusé : Votre compte n\'appartient pas à cette organisation.',
        );
      }
    } else {
      // Super-Admin global (user.tenantId === null/undefined)
      // Ne doit pas accéder directement aux routes isolées des abonnés
      if (requestTenantId) {
        throw new ForbiddenException(
          'Accès refusé : Le Super-Admin global ne peut pas accéder directement à l\'espace isolé d\'un abonné.',
        );
      }
    }

    return true;
  }
}
