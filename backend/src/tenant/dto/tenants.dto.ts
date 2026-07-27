import { IsString, IsOptional, IsNotEmpty, IsEmail, MinLength, Matches } from 'class-validator';

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

export const PHONE_REGEX = /^(\+?[1-9]\d{7,14}|(?:\+221|00221)?\s?(?:7[05678]|33)\d{7})$/;

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  subdomain: string;

  @IsEmail({}, { message: 'Adresse email invalide.' })
  @IsNotEmpty()
  adminEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères.' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.',
  })
  adminPassword: string;

  @IsString()
  @IsNotEmpty()
  adminFirstName: string;

  @IsString()
  @IsNotEmpty()
  adminLastName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire.' })
  @Matches(PHONE_REGEX, {
    message: 'Le numéro de téléphone est invalide (format international ou Sénégalais requis : ex: +221 77 000 00 00).',
  })
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

export class VerifySignupDto {
  @IsString()
  @IsNotEmpty()
  pendingId: string;

  @IsString()
  @IsNotEmpty({ message: 'Le code email à 6 chiffres est obligatoire.' })
  @Matches(/^\d{6}$/, { message: 'Le code email doit comporter exactement 6 chiffres.' })
  emailOtp: string;

  @IsString()
  @IsNotEmpty({ message: 'Le code SMS à 6 chiffres est obligatoire.' })
  @Matches(/^\d{6}$/, { message: 'Le code SMS doit comporter exactement 6 chiffres.' })
  phoneOtp: string;
}

export class ResendCodeDto {
  @IsString()
  @IsNotEmpty()
  pendingId: string;
}

