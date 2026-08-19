import { Module } from '@nestjs/common';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';
import { NotificationsController } from './controllers/notifications.controller';
import { OrderPushListener } from './listeners/order-push.listener';
import { PushSubscriptionsService } from './services/push-subscriptions.service';
import { WebPushService } from './services/web-push.service';

@Module({
  imports: [PrismaTenancyModule],
  controllers: [NotificationsController],
  providers: [WebPushService, PushSubscriptionsService, OrderPushListener],
  exports: [WebPushService],
})
export class NotificationsModule {}
