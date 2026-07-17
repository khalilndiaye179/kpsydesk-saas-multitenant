import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

/**
 * Stratégie JWT Passport.
 *
 * Payload JWT complet (depuis la v2 multi-tenant) :
 * { sub: userId, email, role, systemRole, tenantId }
 *
 * La méthode validate() retourne l'objet qui sera disponible via request.user
 * dans tous les contrôleurs et guards.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key-change-me-in-production',
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    systemRole?: string;
    tenantId?: string;
  }) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      systemRole: payload.systemRole,
      tenantId: payload.tenantId, // ← Clé multi-tenant
    };
  }
}
