import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class EnrollAssetDto {
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsNotEmpty()
  name: string; // hostname

  @IsString()
  @IsOptional()
  os?: string;

  @IsString()
  @IsOptional()
  cpu?: string;

  @IsString()
  @IsOptional()
  ram?: string;

  @IsString()
  @IsOptional()
  storage?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  macAddress?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;
}
