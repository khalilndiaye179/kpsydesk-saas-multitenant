import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;

  constructor() {
    let keyStr = process.env.MFA_ENCRYPTION_KEY;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!keyStr) {
      if (isProduction) {
        throw new Error('FATAL: MFA_ENCRYPTION_KEY variable is missing in production.');
      } else {
        this.logger.warn('⚠️ MFA_ENCRYPTION_KEY variable is missing in development. Using an insecure fallback key.');
        keyStr = '0000000000000000000000000000000000000000000000000000000000000000';
      }
    }

    if (keyStr.length !== 64) {
      throw new Error('MFA_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).');
    }

    try {
      this.key = Buffer.from(keyStr, 'hex');
      if (this.key.length !== 32) {
        throw new Error('Key buffer must be exactly 32 bytes.');
      }
    } catch (err) {
      throw new Error(`Failed to parse MFA_ENCRYPTION_KEY as hex: ${err.message}`);
    }
  }

  /**
   * Chiffre une chaîne en clair avec AES-256-GCM
   * @returns iv:tag:ciphertext (en hexadécimal)
   */
  encrypt(plainText: string): string {
    if (!plainText) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  /**
   * Déchiffre une chaîne chiffrée au format iv:tag:ciphertext
   */
  decrypt(cipherText: string): string {
    if (!cipherText) return '';
    
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format. Expected iv:tag:encryptedText');
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
