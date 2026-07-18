import { IsString, IsOptional, IsNotEmpty, IsEmail } from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsString()
  @IsOptional()
  companyAddress?: string;

  @IsString()
  @IsOptional()
  companyPhone?: string;

  @IsString()
  @IsOptional()
  companyEmail?: string;

  @IsString()
  @IsOptional()
  companyTaxId?: string;
}

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  subdomain: string;

  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  adminPassword: string;

  @IsString()
  @IsNotEmpty()
  adminFirstName: string;

  @IsString()
  @IsNotEmpty()
  adminLastName: string;

  @IsString()
  @IsNotEmpty()
  adminPhone: string;

  @IsString()
  @IsNotEmpty()
  adminCountry: string;

  @IsString()
  @IsNotEmpty()
  adminPosition: string;

  @IsString()
  @IsOptional()
  planName?: string;
}
