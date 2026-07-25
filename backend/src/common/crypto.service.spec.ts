import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    // Clé de test de 64 caractères hexadécimaux
    process.env.MFA_ENCRYPTION_KEY = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    service = new CryptoService();
  });

  afterEach(() => {
    delete process.env.MFA_ENCRYPTION_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt a plaintext string correctly', () => {
    const originalText = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // Exemple de secret Base32 TOTP
    const encrypted = service.encrypt(originalText);
    
    // Vérifier le format iv:tag:ciphertext
    expect(encrypted).toContain(':');
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it('should return empty string if encrypt/decrypt input is empty', () => {
    expect(service.encrypt('')).toBe('');
    expect(service.decrypt('')).toBe('');
  });

  it('should throw an error during initialization in production if key is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MFA_ENCRYPTION_KEY;
    
    expect(() => new CryptoService()).toThrow('FATAL: MFA_ENCRYPTION_KEY variable is missing in production.');
    process.env.NODE_ENV = 'test'; // Restaurer
  });

  it('should throw an error during initialization if key length is not 64 hex characters', () => {
    process.env.MFA_ENCRYPTION_KEY = 'shortkey';
    expect(() => new CryptoService()).toThrow('MFA_ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
  });

  it('should throw an error when decrypting invalid formatted ciphertext', () => {
    expect(() => service.decrypt('invalid_format')).toThrow('Invalid ciphertext format');
  });
});
