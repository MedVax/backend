import { Injectable, Logger } from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import {
  CreatePushSubscriptionDto,
  DeletePushSubscriptionDto,
} from '../dtos/push-subscription.dto';

@Injectable()
export class PushSubscriptionsService {
  private readonly logger = new Logger(PushSubscriptionsService.name);

  constructor(private readonly prismaService: PrismaTenancyService) {}

  /**
   * Stores a browser subscription for `userId`.
   *
   * Endpoints are unique across the table: when a browser re-subscribes after
   * the push service rotated its endpoint, or when a shared device is used by a
   * second admin, the existing row is re-pointed at the current user rather
   * than duplicated.
   */
  async subscribe(userId: string, dto: CreatePushSubscriptionDto) {
    const subscription =
      await this.prismaService.tenancy.pushSubscription.upsert({
        where: { endpoint: dto.endpoint },
        create: {
          userId,
          endpoint: dto.endpoint,
          p256dh: dto.keys.p256dh,
          auth: dto.keys.auth,
          userAgent: dto.userAgent,
        },
        update: {
          userId,
          p256dh: dto.keys.p256dh,
          auth: dto.keys.auth,
          userAgent: dto.userAgent,
          failureCount: 0,
        },
        select: {
          id: true,
          endpoint: true,
          userAgent: true,
          createdAt: true,
        },
      });

    this.logger.log(`Push subscription stored for user ${userId}`);

    return subscription;
  }

  /**
   * Removes a subscription. Scoped to the caller so one admin cannot
   * unsubscribe another's device. Idempotent: unsubscribing an endpoint that is
   * already gone succeeds.
   */
  async unsubscribe(userId: string, dto: DeletePushSubscriptionDto) {
    const { count } =
      await this.prismaService.tenancy.pushSubscription.deleteMany({
        where: { endpoint: dto.endpoint, userId },
      });

    return { removed: count };
  }

  /** Every device the caller has enabled notifications on. */
  findMine(userId: string) {
    return this.prismaService.tenancy.pushSubscription.findMany({
      where: { userId },
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        lastSuccessAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Whether this exact browser endpoint is already registered to the caller. */
  async isSubscribed(userId: string, endpoint: string) {
    const count = await this.prismaService.tenancy.pushSubscription.count({
      where: { userId, endpoint },
    });

    return { subscribed: count > 0 };
  }
}
