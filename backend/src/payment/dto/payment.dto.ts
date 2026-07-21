import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsIn } from 'class-validator';

export class CreatePaymentProviderDto {
  @IsString()
  code: string;

  @IsString()
  displayName: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  config?: any; // The raw credentials, will be encrypted before save

  @IsString()
  @IsIn(['SANDBOX', 'PRODUCTION'])
  @IsOptional()
  environment?: string = 'SANDBOX';

  @IsString()
  @IsOptional()
  currency?: string = 'XOF';

  @IsNumber()
  @IsOptional()
  feePercent?: number;

  @IsNumber()
  @IsOptional()
  settlementDays?: number;
}

export class UpdatePaymentProviderDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  config?: any;

  @IsString()
  @IsIn(['SANDBOX', 'PRODUCTION'])
  @IsOptional()
  environment?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  feePercent?: number;

  @IsNumber()
  @IsOptional()
  settlementDays?: number;

  @IsString()
  @IsOptional()
  performedBy?: string;
}

export class UpdateProviderStatusDto {
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE', 'TEST'])
  status: string;
  
  @IsString()
  @IsOptional()
  performedBy?: string;
}

export class UpdateTenantPaymentMethodDto {
  @IsString()
  @IsIn(['AVAILABLE', 'ACTIVE', 'INACTIVE'])
  tenantStatus: string;
}

export class ConfigureTenantPaymentMethodDto {
  @IsString()
  @IsIn(['AGGREGATOR', 'DIRECT'])
  mode: string;

  @IsObject()
  @IsOptional()
  tenantConfig?: any;
}
