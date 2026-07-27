import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsNotificationService {
  private readonly logger = new Logger(SmsNotificationService.name);

  /**
   * Envoie un SMS via SMSMobileAPI.
   * Nécessite que l'application SMSMobileAPI soit installée et active sur votre téléphone.
   * Documentation : https://smsmobileapi.com/documentation
   *
   * Variables d'environnement requises :
   *   SMS_API_KEY — Clé API disponible dans votre espace SMSMobileAPI
   */
  async sendSms(to: string, message: string, tenantId?: string): Promise<boolean> {
    const apiKey = process.env.SMS_API_KEY;

    if (!to || to.trim() === '') {
      this.logger.warn(
        `[SmsNotificationService] Numéro de téléphone invalide ou absent pour le tenant ${tenantId || 'SaaS'}.`,
      );
      return false;
    }

    if (!apiKey) {
      this.logger.warn(
        `[SMS SIMULATION - CLÉ MANQUANTE] (Tenant: ${tenantId || 'SaaS'}) Destinataire: ${to} | Message: ${message}`,
      );
      return true; // Ne bloque pas le flux si la clé est absente en dev
    }

    try {
      this.logger.log(`[SMSMobileAPI] Envoi SMS vers ${to} (Tenant: ${tenantId || 'SaaS'})...`);

      // Format du numéro : SMSMobileAPI attend le format international sans le "+"
      // Ex: +221771234567 → 221771234567
      const formattedPhone = to.replace(/^\+/, '').replace(/\s/g, '');

      const url = new URL('https://api.smsmobileapi.com/sendsms/');
      url.searchParams.set('apikey', apiKey);
      url.searchParams.set('warecipient', formattedPhone);
      url.searchParams.set('message', message);

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[SMSMobileAPI] Échec HTTP ${response.status} pour ${to}: ${errorText}`,
        );
        return false;
      }

      const result = await response.json().catch(() => ({}));
      this.logger.log(
        `[SMSMobileAPI] SMS envoyé avec succès à ${to}. Réponse: ${JSON.stringify(result)}`,
      );
      return true;
    } catch (error: any) {
      const errMsg = error.message || error;
      this.logger.error(`[SMSMobileAPI] Erreur réseau lors de l'envoi vers ${to}: ${errMsg}`);
      // On ne fait pas planter l'inscription si le SMS échoue
      return false;
    }
  }
}
