import { Module } from '@nestjs/common';
import { TenantInvoicesController } from './tenant-invoices.controller';
import { TenantInvoicesService } from './tenant-invoices.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TenantInvoicesController],
  providers: [TenantInvoicesService],
  exports: [TenantInvoicesService]
})
export class TenantInvoicesModule {}
