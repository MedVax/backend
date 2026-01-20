import { Module, forwardRef } from '@nestjs/common';
import { ConsultantsService } from './services/consultants.service';
import { ConsultantsController } from './controllers/consultants.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [PrismaTenancyModule, forwardRef(() => MailModule)],
  controllers: [ConsultantsController],
  providers: [ConsultantsService],
  exports: [ConsultantsService],
})
export class ConsultantsModule {}
