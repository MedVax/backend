import { Module } from '@nestjs/common';
import { PrescriptionsService } from './services/prescriptions.service';
import { PrescriptionsController } from './controllers/prescriptions.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';

@Module({
  imports: [PrismaTenancyModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
