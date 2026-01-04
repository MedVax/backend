import { Module } from '@nestjs/common';
import { OrdersService } from './services/orders.service';
import { OrdersController } from './controllers/orders.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { PaystackService } from 'modules/services/paystack-service';
import { CartModule } from 'modules/cart/cart.module';

@Module({
  imports: [PrismaTenancyModule, CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, PaystackService],
  exports: [OrdersService],
})
export class OrdersModule {}
