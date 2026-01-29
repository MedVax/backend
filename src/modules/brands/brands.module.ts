import { Module } from '@nestjs/common';
import { BrandsService } from './services/brands.service';
import { BrandsController } from './controllers/brands.controller';
import { BrandsSeedService } from './services/brands-seed.service';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';

@Module({
  imports: [PrismaTenancyModule],
  controllers: [BrandsController],
  providers: [BrandsService, BrandsSeedService],
  exports: [BrandsService],
})
export class BrandsModule {}
