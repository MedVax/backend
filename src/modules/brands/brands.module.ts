import { Module } from '@nestjs/common';
import { BrandsService } from './services/brands.service';
import { BrandsController } from './controllers/brands.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';

@Module({
  imports: [PrismaTenancyModule],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule { }
