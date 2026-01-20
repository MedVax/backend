import { Module, forwardRef } from '@nestjs/common';
import { CalendarIntegrationService } from './services/calendar-integration.service';
import { CalendarIntegrationController } from './controllers/calendar-integration.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { SessionsModule } from 'modules/sessions/sessions.module';

@Module({
  imports: [PrismaTenancyModule, forwardRef(() => SessionsModule)],
  controllers: [CalendarIntegrationController],
  providers: [CalendarIntegrationService],
  exports: [CalendarIntegrationService],
})
export class CalendarIntegrationModule {}
