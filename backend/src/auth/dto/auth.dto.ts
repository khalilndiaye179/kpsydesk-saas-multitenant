import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  @IsNotEmpty()
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
