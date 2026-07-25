import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private failureCount = 0;
  private isAlertSent = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Vérifie la connectivité à la base de données via Prisma
   */
  async checkDatabase(): Promise<boolean> {
    try {
      // Requête légère SELECT 1 pour valider l'état de la connexion
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      this.logger.error(`Database health check failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Surveillance périodique exécutée toutes les 60 secondes (60000 ms)
   */
  @Interval(60000)
  async monitorHealth() {
    const isHealthy = await this.checkDatabase();
    const alertEmail = process.env.ALERT_EMAIL;
    const threshold = parseInt(process.env.ALERT_THRESHOLD || '3', 10);

    if (!isHealthy) {
      this.failureCount++;
      this.logger.warn(`Database check failure: ${this.failureCount}/${threshold}`);

      // Déclencher l'email d'alerte si le seuil est atteint et qu'aucun email n'a encore été envoyé
      if (this.failureCount >= threshold && !this.isAlertSent && alertEmail) {
        await this.sendAlertEmail(alertEmail);
      }
    } else {
      // Si la base est de nouveau en ligne après un incident, envoyer l'email de résolution
      if (this.isAlertSent && alertEmail) {
        await this.sendResolutionEmail(alertEmail);
      }
      // Réinitialiser les compteurs d'incidents
      this.failureCount = 0;
      this.isAlertSent = false;
    }
  }

  private async sendAlertEmail(email: string) {
    try {
      const subject = `🚨 ALERTE : Dysfonctionnement de la Base de Données KPSyDesk`;
      const text = `La base de données PostgreSQL de KPSyDesk ne répond plus depuis plus de ${this.failureCount} vérifications consécutives. Statut actuel: HORS LIGNE.`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 25px; border: 2px solid #ef4444; border-radius: 8px; max-width: 600px; background-color: #fef2f2; color: #7f1d1d;">
          <h2 style="color: #ef4444; margin-top: 0; display: flex; align-items: center; gap: 8px;">
            🚨 Alerte de Disponibilité KPSyDesk
          </h2>
          <p>Le service de surveillance a détecté une coupure de connexion entre l'API NestJS et le serveur PostgreSQL.</p>
          <hr style="border: 0; border-top: 1px solid #fee2e2; margin: 20px 0;" />
          <p><strong>Détails de l'incident :</strong></p>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 180px;">Plateforme :</td>
              <td style="padding: 6px 0; color: #1e1b4b;">app.kpsyinformatique.com</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Statut de la base :</td>
              <td style="padding: 6px 0; color: #b91c1c; font-weight: bold;">HORS LIGNE</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Pannes consécutives :</td>
              <td style="padding: 6px 0;">${this.failureCount} (intervalle de 1 minute)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Date de détection :</td>
              <td style="padding: 6px 0;">${new Date().toLocaleString('fr-FR')}</td>
            </tr>
          </table>
          <p style="margin-top: 20px; font-style: italic; color: #ef4444;">
            Une intervention technique ou un redémarrage des conteneurs docker peut être requis.
          </p>
          <hr style="border: 0; border-top: 1px solid #fee2e2; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 0.8em; margin: 0;">
            Cet e-mail automatique a été envoyé par le module HealthService de l'application. 
            Aucun autre email ne sera envoyé tant que l'incident persistera.
          </p>
        </div>
      `;
      // sendMail gère les try/catch en interne, mais nous protégeons l'état local ici
      await this.mailService.sendMail(email, subject, text, html);
      this.isAlertSent = true;
      this.logger.log(`Alert email triggered and sent successfully to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send alert email: ${err.message}`);
    }
  }

  private async sendResolutionEmail(email: string) {
    try {
      const subject = `✅ RÉSOLU : Retour à la normale de la Base de Données KPSyDesk`;
      const text = `La connexion de KPSyDesk avec PostgreSQL a repris son fonctionnement normal. Le statut de l'application est de nouveau: EN LIGNE.`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 25px; border: 2px solid #10b981; border-radius: 8px; max-width: 600px; background-color: #f0fdf4; color: #064e3b;">
          <h2 style="color: #10b981; margin-top: 0; display: flex; align-items: center; gap: 8px;">
            ✅ Incident Résolu - KPSyDesk
          </h2>
          <p>Le serveur de base de données PostgreSQL répond à nouveau correctement aux requêtes de santé de l'API.</p>
          <hr style="border: 0; border-top: 1px solid #dcfce7; margin: 20px 0;" />
          <p><strong>Détails du rétablissement :</strong></p>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; width: 180px;">Plateforme :</td>
              <td style="padding: 6px 0; color: #1e1b4b;">app.kpsyinformatique.com</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Statut de la base :</td>
              <td style="padding: 6px 0; color: #047857; font-weight: bold;">EN LIGNE</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold;">Date de résolution :</td>
              <td style="padding: 6px 0;">${new Date().toLocaleString('fr-FR')}</td>
            </tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #dcfce7; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 0.8em; margin: 0;">
            Le module HealthService continuera de veiller automatiquement à la disponibilité de la plateforme.
          </p>
        </div>
      `;
      await this.mailService.sendMail(email, subject, text, html);
      this.logger.log(`Resolution email triggered and sent successfully to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send resolution email: ${err.message}`);
    }
  }

  // Permet aux tests unitaires de manipuler l'état pour forcer la vérification
  getFailureCount() { return this.failureCount; }
  getIsAlertSent() { return this.isAlertSent; }
}
