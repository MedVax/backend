import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './controllers/payments.controller';
import { PaystackService } from 'modules/services/paystack-service';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { OrdersModule } from 'modules/orders/orders.module';

@Module({
  imports: [PrismaTenancyModule, forwardRef(() => OrdersModule)],
  controllers: [PaymentsController],
  providers: [PaystackService],
})
export class PaymentsModule {}
