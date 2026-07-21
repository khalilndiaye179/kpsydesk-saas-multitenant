import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray, IsDateString, IsObject } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  status: TenantStatus;
}

export class UpdateTenantQuotasDto {
  @IsNumber()
  @IsOptional()
  quotaAssets?: number;

  @IsNumber()
  @IsOptional()
  quotaUsers?: number;
}

export class ConfigurePaymentDto {
  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  apiSecret: string;

  @IsString()
  @IsOptional()
  merchantId?: string;

  @IsBoolean()
  isSandbox: boolean;

  @IsBoolean()
  isActive: boolean;
}

export class CreatePlanDto {
  @IsNumber()
  price: number;

  @IsNumber()
  quotaAssets: number;

  @IsNumber()
  quotaUsers: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  features?: string[];

  @IsNumber()
  @IsOptional()
  annualDiscountPct?: number;

  @IsObject()
  @IsOptional()
  featuresIncluded?: Record<string, boolean>;
}

export class CreatePromoDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  discountPct: number;

  @IsNumber()
  @IsOptional()
  maxUses?: number;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsString()
  @IsOptional()
  planId?: string;
}

export class UpdatePromoDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @IsOptional()
  discountPct?: number;

  @IsNumber()
  @IsOptional()
  maxUses?: number;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateVolumeDiscountDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsNumber()
  minAssets: number;

  @IsNumber()
  minUsers: number;

  @IsNumber()
  discountPct: number;

  @IsString()
  @IsNotEmpty()
  label: string;
}

export class GenerateQuoteDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  clientEmail?: string;

  @IsNumber()
  @IsOptional()
  assetsCount?: number;

  @IsNumber()
  @IsOptional()
  usersCount?: number;

  @IsString()
  @IsOptional()
  promoCode?: string;

  @IsBoolean()
  @IsOptional()
  applyTva?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  billingCycle?: string;

  @IsNumber()
  @IsOptional()
  customAnnualDiscountPct?: number;
}

export class ApplyPromoDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class UpdateQuoteStatusDto {
  @IsString()
  @IsNotEmpty()
  status: string;
}

export class TestInvoiceGenerationDto {
  @IsString()
  @IsNotEmpty()
  generatorUser: string;
}

export class GenerateInvoicesPeriodDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsNotEmpty()
  generatorUser: string;
}

export class SuperAdminCreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  systemRole: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  entryDate?: string | Date;
}

export class SuperAdminUpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  systemRole?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  entryDate?: string | Date;
}
