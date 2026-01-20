import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './controllers/payments.controller';
import { PaystackService } from 'modules/services/paystack-service';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { OrdersModule } from 'modules/orders/orders.module';
import { SessionsModule } from 'modules/sessions/sessions.module';
import { TransactionsModule } from 'modules/transactions/transactions.module';

@Module({
  imports: [
    PrismaTenancyModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => SessionsModule),
    forwardRef(() => TransactionsModule),
  ],
  controllers: [PaymentsController],
  providers: [PaystackService],
})
export class PaymentsModule {}
