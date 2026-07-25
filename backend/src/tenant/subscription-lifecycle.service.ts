import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SmsNotificationService } from './sms-notification.service';

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsNotificationService
  ) {}

  @Cron('0 0 * * *') // Exécuté tous les jours à minuit
  async handleCron() {
    this.logger.log('Starting daily subscription lifecycle check...');
    await this.processCycles();
    await this.purgeOldPageViews();
    
    // Relances automatiques J-7 et J-1 (Livrable A)
    try {
      await this.sendExpirationReminders();
    } catch (reminderError) {
      this.logger.error('Failed to run subscription expiration reminders:', reminderError);
    }
  }

  async purgeOldPageViews() {
    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.log(`Purging PageView entries older than ${retentionDays} days (before ${cutoffDate.toISOString()})...`);
    
    try {
      const deleteResult = await this.prisma.pageView.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });
      this.logger.log(`Purged ${deleteResult.count} PageView entries successfully.`);
      return deleteResult.count;
    } catch (error) {
      this.logger.error('Failed to purge old PageView entries:', error);
      throw error;
    }
  }

  async sendExpirationReminders() {
    this.logger.log('Starting subscription expiration reminders check...');
    const now = new Date();

    // 1. Trouver les abonnements actifs ou en essai dont la date de fin (endDate) est dans le futur
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD'] },
        endDate: { gte: now }
      },
      include: {
        tenant: true
      }
    });

    for (const sub of activeSubscriptions) {
      if (!sub.endDate) continue;

      // Calcul de la différence de jours
      const diffTime = sub.endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Les paliers cibles de relance
      let reminderDays = 0;
      if (diffDays <= 7 && diffDays > 1) {
        reminderDays = 7;
      } else if (diffDays <= 1 && diffDays >= 0) {
        reminderDays = 1;
      }

      if (reminderDays === 0) continue;

      // 2. Vérifier si un rappel a déjà été envoyé pour ce palier
      const alreadySent = await this.prisma.subscriptionReminderLog.findUnique({
        where: {
          subscriptionId_reminderDays: {
            subscriptionId: sub.id,
            reminderDays
          }
        }
      });

      if (alreadySent) {
        this.logger.debug(`Reminder for subscription ${sub.id} at J-${reminderDays} already sent.`);
        continue;
      }

      // 3. Récupérer l'administrateur du tenant pour le numéro de téléphone
      const admin = await this.prisma.user.findFirst({
        where: {
          tenantId: sub.tenantId,
          role: 'ADMIN'
        }
      });

      const phone = admin?.phone || sub.tenant.companyPhone;

      if (!phone) {
        this.logger.warn(`No phone number found for Tenant ${sub.tenant.name} (${sub.tenantId}) to send subscription expiration reminder.`);
        continue;
      }

      // 4. Composer et envoyer le message
      const message = reminderDays === 7 
        ? `[KPSyDesk] Rappel : Votre abonnement pour l'espace ${sub.tenant.name} expire dans 7 jours (${sub.endDate.toLocaleDateString('fr-FR')}). Pensez à renouveler votre offre.`
        : `[KPSyDesk] IMPORTANT : Votre abonnement pour l'espace ${sub.tenant.name} expire demain (${sub.endDate.toLocaleDateString('fr-FR')}). Renouvelez aujourd'hui pour éviter toute interruption de service.`;

      try {
        await this.smsService.sendSms(phone, message, sub.tenantId);

        // Enregistrer le log de succès
        await this.prisma.subscriptionReminderLog.create({
          data: {
            subscriptionId: sub.id,
            tenantId: sub.tenantId,
            reminderDays,
            status: 'SUCCESS'
          }
        });
      } catch (smsError: any) {
        this.logger.error(`Failed to send SMS reminder to ${phone} for subscription ${sub.id}: ${smsError.message || smsError}`);
        
        // Enregistrer le log d'échec
        await this.prisma.subscriptionReminderLog.create({
          data: {
            subscriptionId: sub.id,
            tenantId: sub.tenantId,
            reminderDays,
            status: 'FAILED',
            errorMessage: smsError.message || String(smsError)
          }
        }).catch((dbErr) => {
          this.logger.error(`Failed to write failure log to database for subscription ${sub.id}:`, dbErr);
        });
      }
    }
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
