import { IsEmail, IsNotEmpty, IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({}, { message: 'L\'adresse email est invalide.' })
  @IsNotEmpty({ message: 'L\'email est obligatoire.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de famille est obligatoire.' })
  lastName: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsEnum(Role, { message: 'Le rôle doit être valide.' })
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional()
  systemRole?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsBoolean()
  @IsOptional()
  mfaEnabled?: boolean;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
