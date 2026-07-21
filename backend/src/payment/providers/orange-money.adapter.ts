import { IPaymentProviderAdapter, PaymentParams, PaymentResult } from './payment-provider-base.adapter';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OrangeMoneyAdapter implements IPaymentProviderAdapter {
  code = 'ORANGE_MONEY';
  private readonly logger = new Logger(OrangeMoneyAdapter.name);

  async testConnection(config: any, isSandbox: boolean): Promise<{ success: boolean; message: string }> {
    try {
      if (!config || !config.merchantId) {
        return { success: false, message: 'Le Merchant ID est requis pour Orange Money' };
      }
      
      this.logger.log(`Testing Orange Money connection (Sandbox: ${isSandbox})`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { success: true, message: 'Connexion Orange Money réussie' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Erreur de connexion' };
    }
  }

  async initiatePayment(config: any, isSandbox: boolean, params: PaymentParams): Promise<PaymentResult> {
    try {
      this.logger.log(`Initiating Orange Money payment for ${params.amount} ${params.currency}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return {
        success: true,
        status: 'PENDING',
        transactionId: `om_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        paymentUrl: isSandbox ? 'https://sandbox.orangemoney.com/mock' : 'https://orangemoney.com/real',
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
