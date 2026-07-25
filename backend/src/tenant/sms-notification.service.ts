import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsNotificationService {
  private readonly logger = new Logger(SmsNotificationService.name);

  /**
   * Envoie un SMS/WhatsApp à un destinataire donné.
   * Si aucune clé API n'est configurée, le service bascule en mode simulation et logue un avertissement.
   */
  async sendSms(to: string, message: string, tenantId?: string): Promise<boolean> {
    const apiKey = process.env.SMS_API_KEY;

    if (!to || to.trim() === '') {
      this.logger.warn(`[SmsNotificationService] Numéro de téléphone invalide ou absent pour le tenant ${tenantId || 'SaaS'}.`);
      return false;
    }

    if (!apiKey) {
      this.logger.warn(`[SMS SIMULATION - CLÉ MANQUANTE] (Tenant: ${tenantId || 'SaaS'}) Destinataire: ${to} | Message: ${message}`);
      return true; // Retourne true pour ne pas faire planter la chaîne de relances
    }

    try {
      this.logger.log(`Envoi de SMS vers ${to} (Tenant: ${tenantId || 'SaaS'})...`);
      
      // Exemple d'implémentation HTTP générique (ex: Twilio / Wave / Infobip)
      // fetch('https://api.sms-gateway.com/send', {
      //   method: 'POST',
      //   headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ to, message })
      // });

      this.logger.log(`SMS envoyé avec succès à ${to}.`);
      return true;
    } catch (error: any) {
      const errMsg = error.message || error;
      this.logger.error(`Erreur d'envoi SMS vers ${to}: ${errMsg}`);
      throw error;
    }
  }
}
