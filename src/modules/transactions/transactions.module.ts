import { Module } from '@nestjs/common';
import { TransactionsService } from './services/transactions.service';
import { TransactionsController } from './controllers/transactions.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';

@Module({
  imports: [PrismaTenancyModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
