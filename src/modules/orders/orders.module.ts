import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './services/orders.service';
import { OrdersController } from './controllers/orders.controller';
import { DeliveryFeeService } from './services/delivery-fee.service';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { PaystackService } from 'modules/services/paystack-service';
import { CartModule } from 'modules/cart/cart.module';
import { StockModule } from 'modules/stock/stock.module';
import { TransactionsModule } from 'modules/transactions/transactions.module';
import { RECURRING_ORDERS } from 'constants/queue.constant';
import { RecurringOrdersProcessor } from './processors/recurring-orders.processor';
import { RecurringOrdersScheduler } from './services/recurring-orders.scheduler';

@Module({
  imports: [
    PrismaTenancyModule,
    CartModule,
    StockModule,
    forwardRef(() => TransactionsModule),
    BullModule.registerQueue({ name: RECURRING_ORDERS }),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    DeliveryFeeService,
    PaystackService,
    RecurringOrdersProcessor,
    RecurringOrdersScheduler,
  ],
  exports: [OrdersService, DeliveryFeeService],
})
export class OrdersModule {}
