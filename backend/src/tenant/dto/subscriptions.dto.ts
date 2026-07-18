import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RecordPaymentDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  status: 'success' | 'failed';
}

export class SimulateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  planName: string;

  @IsString()
  @IsOptional()
  billingInterval?: string;
}
