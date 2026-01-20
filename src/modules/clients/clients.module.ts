import { Module } from '@nestjs/common';
import { ClientsService } from './services/clients.service';
import { ClientsController } from './controllers/clients.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';

@Module({
  imports: [PrismaTenancyModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
