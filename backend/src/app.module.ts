import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AssetsModule } from './assets/assets.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ExtraModule } from './extra/extra.module';
import { TenantModule } from './tenant/tenant.module';
import { TenantMiddleware } from './tenant/tenant.middleware';

import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ── Rate limiting global (par IP + par tenant via l'extension Prisma) ──
    ThrottlerModule.forRoot([
      {
        name: 'short',   // Rafale courte : 20 requêtes / 1 seconde
        ttl: 1000,
        limit: 20,
      },
      {
        name: 'medium',  // Limite principale : 200 requêtes / minute
        ttl: 60000,
        limit: 200,
      },
      {
        name: 'long',    // Protection DDoS : 1000 requêtes / 15 minutes
        ttl: 900000,
        limit: 1000,
      },
    ]),

    // ── Modules fonctionnels ──
    PrismaModule,
    AuthModule,
    TenantModule,
    AssetsModule,
    TicketsModule,
    UsersModule,
    ExtraModule,
  ],
  controllers: [],
  providers: [
    // ThrottlerGuard appliqué globalement à toutes les routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * TenantMiddleware appliqué à toutes les routes /api/*.
   * Doit s'exécuter AVANT tous les guards et contrôleurs.
   *
   * Exception : les routes publiques comme /api/tenants/signup et /api/tenants/plans
   * passent quand même par le middleware, mais sans contexte tenant (aucun sous-domaine
   * ni header X-Tenant-ID fourni) → le middleware les laisse passer sans erreur.
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
