export interface PaymentParams {
  amount: number;
  currency: string;
  reference: string;
  customerPhone?: string;
  customerEmail?: string;
  description?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  message?: string;
  rawResponse?: any;
}

export interface IPaymentProviderAdapter {
  code: string;
  
  /**
   * Tests the connection to the payment provider using the provided configuration.
   * Used by Super Admin to verify credentials before activating a provider.
   */
  testConnection(config: any, isSandbox: boolean): Promise<{ success: boolean; message: string }>;
  
  /**
   * Initiates a payment.
   */
  initiatePayment(config: any, isSandbox: boolean, params: PaymentParams): Promise<PaymentResult>;
}
