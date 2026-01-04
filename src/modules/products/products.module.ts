import { Module } from '@nestjs/common';
import { ProductsService } from './services/products.service';
import { ProductsController } from './controllers/products.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { CategoriesModule } from 'modules/categories/categories.module';

@Module({
  imports: [PrismaTenancyModule, CategoriesModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
