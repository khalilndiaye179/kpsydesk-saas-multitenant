import { Test, TestingModule } from '@nestjs/testing';
import { PaymentCryptoService } from './payment-crypto.service';

describe('PaymentCryptoService', () => {
  let service: PaymentCryptoService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv, PAYMENT_ENCRYPTION_KEY: '12345678901234567890123456789012' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentCryptoService],
    }).compile();

    service = module.get<PaymentCryptoService>(PaymentCryptoService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should encrypt and decrypt data correctly', () => {
    const data = { apiKey: 'test-api-key', secret: 'test-secret' };
    const encrypted = service.encrypt(data);
    
    expect(encrypted).toBeDefined();
    expect(encrypted).toContain(':'); // IV and auth tag are separated by colon
    
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toEqual(data);
  });
});
