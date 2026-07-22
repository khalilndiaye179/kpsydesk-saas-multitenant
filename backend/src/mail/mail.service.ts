import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  onModuleInit() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });
      this.isConfigured = true;
      this.logger.log(`SMTP transport configuré avec ${host}:${port}`);
    } else {
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn('⚠️ Variables SMTP manquantes en production. L\'envoi d\'emails échouera silencieusement.');
      } else {
        this.logger.log('Variables SMTP manquantes en développement. Les emails seront simulés dans la console.');
      }
    }
  }

  async sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@kpsyinformatique.com';
    const fromName = process.env.SMTP_FROM_NAME || 'KPSyDesk';
    const from = `"${fromName}" <${fromEmail}>`;

    try {
      if (this.isConfigured && this.transporter) {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          text,
          html,
        });
        this.logger.log(`Email envoyé avec succès à ${to}`);
      } else {
        // Mode fallback (simulation)
        this.logger.log('--- EMAIL SIMULÉ ---');
        this.logger.log(`De: ${from}`);
        this.logger.log(`À: ${to}`);
        this.logger.log(`Sujet: ${subject}`);
        this.logger.log(`Message:\n${text}`);
        this.logger.log('--------------------');
      }
    } catch (error) {
      // Non-bloquant
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
    }
  }
}
