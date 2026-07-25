import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenantInvoiceItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateTenantInvoiceDto {
  @IsString()
  clientName: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsString()
  clientNinea?: string;

  @IsOptional()
  @IsString()
  clientRc?: string;

  @IsNumber()
  @Min(0)
  tvaRate: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ generosity: true, each: true })
  @Type(() => CreateTenantInvoiceItemDto)
  items: CreateTenantInvoiceItemDto[];
}
