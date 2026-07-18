import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'L\'adresse email est invalide.' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RequestResetDto {
  @IsEmail({}, { message: 'L\'adresse email est invalide.' })
  @IsOptional()
  recoveryEmail?: string;

  @IsString()
  @IsOptional()
  recoveryPhone?: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères.' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.',
  })
  newPassword: string;
}

export class UpdateProfileDto {
  @IsEmail({}, { message: 'L\'adresse email est invalide.' })
  @IsOptional()
  recoveryEmail?: string;

  @IsString()
  @IsOptional()
  recoveryPhone?: string;
}
