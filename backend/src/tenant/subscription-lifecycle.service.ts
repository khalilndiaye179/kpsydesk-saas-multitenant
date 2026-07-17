import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 * * *') // Exécuté tous les jours à minuit
  async handleCron() {
    this.logger.log('Starting daily subscription lifecycle check...');
    await this.processCycles();
  }

  async processCycles() {
    const now = new Date();
    const gracePeriodMs = 2 * 24 * 60 * 60 * 1000; // 2 jours en millisecondes

    // Trouver tous les abonnements potentiellement expirés ou en grâce
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'] },
        endDate: { lt: now },
      },
    });

    for (const sub of subscriptions) {
      if (!sub.endDate) continue;

      const diffMs = now.getTime() - sub.endDate.getTime();

      if (diffMs <= gracePeriodMs) {
        // Dans la période de grâce de 2 jours
        if (sub.status !== 'GRACE_PERIOD') {
          this.logger.log(`Subscription ${sub.id} (tenant: ${sub.tenantId}) enters GRACE_PERIOD.`);
          await this.prisma.$transaction([
            this.prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'GRACE_PERIOD' },
            }),
            this.prisma.tenant.update({
              where: { id: sub.tenantId },
              data: { status: 'GRACE_PERIOD' },
            }),
          ]);
        }
      } else {
        // Échéance dépassée de plus de 2 jours -> SUSPENDU
        this.logger.log(`Subscription ${sub.id} (tenant: ${sub.tenantId}) has expired past the grace period. Suspending.`);
        await this.prisma.$transaction([
          this.prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'PAST_DUE' },
          }),
          this.prisma.tenant.update({
            where: { id: sub.tenantId },
            data: { status: 'SUSPENDED' },
          }),
        ]);
      }
    }
  }
}
