import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from 'generated/prisma/client';
import { UserType } from 'generated/prisma/enums';
import { AuthUser } from 'params/auth-user.param';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { Response } from 'metadatas/response.metadata';
import { PushSubscriptionsService } from '../services/push-subscriptions.service';
import { WebPushService } from '../services/web-push.service';
import {
  CreatePushSubscriptionDto,
  DeletePushSubscriptionDto,
} from '../dtos/push-subscription.dto';
import { NOTIFICATION_TAGS } from '../constants/notifications.constant';

@Controller('notifications/push')
@ApiTags('Notifications')
@AuthUserGuard([UserType.ADMIN])
export class NotificationsController {
  constructor(
    private readonly pushSubscriptionsService: PushSubscriptionsService,
    private readonly webPushService: WebPushService,
  ) {}

  @Get('public-key')
  @Response({ status: HttpStatus.OK, message: 'VAPID public key fetched' })
  @ApiOperation({
    summary: 'VAPID public key the browser needs to create a subscription',
  })
  getPublicKey() {
    return {
      publicKey: this.webPushService.publicKey,
      enabled: this.webPushService.isEnabled,
    };
  }

  @Get('subscriptions')
  @Response({ status: HttpStatus.OK, message: 'Subscriptions fetched' })
  @ApiOperation({ summary: 'List the devices this admin receives push on' })
  findMine(@AuthUser() user: User) {
    return this.pushSubscriptionsService.findMine(user.id);
  }

  @Get('status')
  @Response({ status: HttpStatus.OK, message: 'Subscription status fetched' })
  @ApiOperation({ summary: 'Whether a given browser endpoint is registered' })
  status(@Query('endpoint') endpoint: string, @AuthUser() user: User) {
    return this.pushSubscriptionsService.isSubscribed(user.id, endpoint);
  }

  @Post('subscribe')
  @Response({
    status: HttpStatus.CREATED,
    message: 'Push notifications enabled for this device',
  })
  @ApiOperation({ summary: 'Register a browser push subscription' })
  subscribe(@Body() dto: CreatePushSubscriptionDto, @AuthUser() user: User) {
    return this.pushSubscriptionsService.subscribe(user.id, dto);
  }

  @Delete('unsubscribe')
  @Response({
    status: HttpStatus.OK,
    message: 'Push notifications disabled for this device',
  })
  @ApiOperation({ summary: 'Remove a browser push subscription' })
  unsubscribe(@Body() dto: DeletePushSubscriptionDto, @AuthUser() user: User) {
    return this.pushSubscriptionsService.unsubscribe(user.id, dto);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @Response({ status: HttpStatus.OK, message: 'Test notification sent' })
  @ApiOperation({ summary: "Send a test push to the caller's own devices" })
  test(@AuthUser() user: User) {
    return this.webPushService.sendToUser(user.id, {
      title: 'MedVax Admin',
      body: 'Push notifications are working. You will be alerted here when a new order comes in.',
      tag: NOTIFICATION_TAGS.TEST,
      url: '/settings/notifications',
      type: 'TEST',
    });
  }
}
