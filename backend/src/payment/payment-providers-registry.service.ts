import { Injectable, Logger } from '@nestjs/common';
import { IPaymentProviderAdapter } from './providers/payment-provider-base.adapter';
import { WaveAdapter } from './providers/wave.adapter';
import { OrangeMoneyAdapter } from './providers/orange-money.adapter';
// Add more adapters here

@Injectable()
export class PaymentProvidersRegistryService {
  private readonly adapters = new Map<string, IPaymentProviderAdapter>();
  private readonly logger = new Logger(PaymentProvidersRegistryService.name);

  constructor(
    private readonly waveAdapter: WaveAdapter,
    private readonly orangeMoneyAdapter: OrangeMoneyAdapter,
  ) {
    this.registerAdapter(this.waveAdapter);
    this.registerAdapter(this.orangeMoneyAdapter);
    this.logger.log(`Registered ${this.adapters.size} payment adapters`);
  }

  private registerAdapter(adapter: IPaymentProviderAdapter) {
    this.adapters.set(adapter.code, adapter);
  }

  getAdapter(code: string): IPaymentProviderAdapter {
    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw new Error(`Payment adapter for ${code} not found or not supported`);
    }
    return adapter;
  }
}
