import { Module } from '@nestjs/common';
import { PrescriptionsService } from './services/prescriptions.service';
import { PrescriptionsController } from './controllers/prescriptions.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  imports: [PrismaTenancyModule, UploadsModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
