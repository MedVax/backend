import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import {
  PrismaTenancyClientProvider,
  TENANCY_CLIENT_TOKEN,
} from './prisma-tenancy.provider';
import { PrismaTenancyService } from './prisma-tenancy.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [PrismaTenancyClientProvider, PrismaTenancyService],
  exports: [TENANCY_CLIENT_TOKEN, PrismaTenancyService],
})
export class PrismaTenancyModule {}
