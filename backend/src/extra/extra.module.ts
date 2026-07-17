import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExtraController } from './extra.controller';
import { ExtraService } from './extra.service';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [PrismaModule, AuthModule, TenantModule],
  controllers: [ExtraController],
  providers: [ExtraService],
  exports: [ExtraService],
})
export class ExtraModule {}
