import { Module } from '@nestjs/common';
import { PharmacyService } from './services/pharmacy.service';
import { PharmacyController } from './controllers/pharmacy.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';

@Module({
  imports: [PrismaTenancyModule],
  controllers: [PharmacyController],
  providers: [PharmacyService],
  exports: [PharmacyService],
})
export class PharmacyModule {}
