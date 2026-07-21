import { IPaymentProviderAdapter, PaymentParams, PaymentResult } from './payment-provider-base.adapter';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WaveAdapter implements IPaymentProviderAdapter {
  code = 'WAVE';
  private readonly logger = new Logger(WaveAdapter.name);

  async testConnection(config: any, isSandbox: boolean): Promise<{ success: boolean; message: string }> {
    try {
      if (!config || !config.apiKey) {
        return { success: false, message: 'La clé API est requise pour Wave' };
      }
      
      // MOCK: In a real scenario, we would make an HTTP request to Wave's API to verify the token
      this.logger.log(`Testing Wave connection (Sandbox: ${isSandbox}) with provided config`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { success: true, message: 'Connexion Wave réussie' };
    } catch (error: any) {
      this.logger.error('Erreur lors du test Wave', error);
      return { success: false, message: error.message || 'Erreur de connexion' };
    }
  }

  async initiatePayment(config: any, isSandbox: boolean, params: PaymentParams): Promise<PaymentResult> {
    try {
      this.logger.log(`Initiating Wave payment for ${params.amount} ${params.currency}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return {
        success: true,
        status: 'PENDING',
        transactionId: `wv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        paymentUrl: isSandbox ? 'https://sandbox.wave.com/pay/mock' : 'https://wave.com/pay/real',
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'FAILED',
        message: error.message,
      };
    }
  }
}
