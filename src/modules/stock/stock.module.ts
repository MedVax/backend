import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StockService } from './services/stock.service';
import { StockController } from './controllers/stock.controller';
import { StockProcessor } from './processors/stock.processor';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { STOCK } from 'constants/queue.constant';

@Module({
  imports: [PrismaTenancyModule, BullModule.registerQueue({ name: STOCK })],
  controllers: [StockController],
  providers: [StockService, StockProcessor],
  exports: [StockService],
})
export class StockModule {}
