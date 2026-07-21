import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PaymentCryptoService {
  private readonly logger = new Logger(PaymentCryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.PAYMENT_ENCRYPTION_KEY;
    if (!secret || secret.length < this.keyLength) {
      this.logger.warn('PAYMENT_ENCRYPTION_KEY is not set or too short. Payment credentials encryption will fail.');
      // Fallback for development if needed, but ideally should fail fast in production
      this.key = crypto.scryptSync(secret || 'default_dev_secret_key_needs_32_bytes', 'salt', this.keyLength);
    } else {
      // Assuming secret is provided as a 64-char hex string (32 bytes) or raw 32-char string
      this.key = Buffer.from(secret.padEnd(this.keyLength, '0').slice(0, this.keyLength));
    }
  }

  encrypt(data: object): string {
    try {
      const text = JSON.stringify(data);
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:encryptedData
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Failed to encrypt payment data', error);
      throw new Error('Encryption failed');
    }
  }

  decrypt(encryptedText: string): any {
    if (!encryptedText) return null;
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error('Failed to decrypt payment data', error);
      throw new Error('Decryption failed');
    }
  }
}
