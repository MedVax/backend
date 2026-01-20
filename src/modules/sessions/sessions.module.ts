import { Module, forwardRef } from '@nestjs/common';
import { SessionsService } from './services/sessions.service';
import { SessionsController } from './controllers/sessions.controller';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { AvailableQuotaSessionsService } from './services/available-quota.sessions.service';
import { ProviderAvailabilityService } from './services/provider-availability.service';
import { MeetingService } from './services/meeting.service';
import { CalendarService } from './services/calendar.service';
import { GiftSessionsService } from './services/gift.sessions.service';
import { RescheduleRequestsSessionsService } from './services/reschedule-requests.sessions.service';
import { SessionsScheduler } from './services/sessions.scheduler';
import { SessionCreatedListener } from './listeners/session-created.listener';
import { SessionCancellationNotificationListener } from './listeners/session-cancellation-notification.listener';
import { SessionRescheduleNotificationListener } from './listeners/session-reschedule-notification.listener';
import { PaystackService } from 'modules/services/paystack-service';
import { MailModule } from 'src/mail/mail.module';
import { TransactionsModule } from 'modules/transactions/transactions.module';
import { CalendarIntegrationModule } from 'modules/calendar-integration/calendar-integration.module';

@Module({
  imports: [
    PrismaTenancyModule,
    forwardRef(() => MailModule),
    forwardRef(() => TransactionsModule),
    forwardRef(() => CalendarIntegrationModule),
  ],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    AvailableQuotaSessionsService,
    ProviderAvailabilityService,
    MeetingService,
    CalendarService,
    GiftSessionsService,
    RescheduleRequestsSessionsService,
    SessionsScheduler,
    SessionCreatedListener,
    SessionCancellationNotificationListener,
    SessionRescheduleNotificationListener,
    PaystackService,
  ],
  exports: [
    SessionsService,
    AvailableQuotaSessionsService,
    ProviderAvailabilityService,
    MeetingService,
    CalendarService,
    GiftSessionsService,
    RescheduleRequestsSessionsService,
  ],
})
export class SessionsModule {}
