import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webPush from 'web-push';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { UserStatus, UserType } from 'generated/prisma/enums';
import {
  VAPID_PRIVATE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_SUBJECT,
} from 'constants/env.constant';
import {
  MAX_PUSH_FAILURES,
  PUSH_BATCH_SIZE,
} from '../constants/notifications.constant';

/** The JSON the service worker receives in its `push` event. */
export interface PushPayload {
  title: string;
  body: string;
  /** Notifications sharing a tag replace one another in the tray. */
  tag?: string;
  /** In-app path opened when the notification is clicked. */
  url?: string;
  /** Discriminator the client uses to decide what to refresh. */
  type?: string;
  data?: Record<string, unknown>;
  /** Ask the OS to vibrate/alert rather than deliver silently. */
  renotify?: boolean;
  requireInteraction?: boolean;
}

interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failureCount: number;
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);

  /** False when VAPID keys are not configured; every send becomes a no-op. */
  private enabled = false;

  constructor(private readonly prismaService: PrismaTenancyService) {}

  onModuleInit() {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      this.logger.warn(
        'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set - web push is disabled. ' +
          'Generate a pair with `npx web-push generate-vapid-keys`.',
      );
      return;
    }

    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    this.enabled = true;
    this.logger.log('Web push configured');
  }

  get isEnabled() {
    return this.enabled;
  }

  get publicKey(): string | null {
    return this.enabled ? VAPID_PUBLIC_KEY : null;
  }

  /** Push to every active admin/super-admin that has enabled notifications. */
  async sendToAdmins(payload: PushPayload) {
    const subscriptions =
      await this.prismaService.tenancy.pushSubscription.findMany({
        where: {
          user: {
            type: { in: [UserType.ADMIN, UserType.SUPER_ADMIN] },
            status: UserStatus.ACTIVE,
          },
        },
        select: {
          id: true,
          endpoint: true,
          p256dh: true,
          auth: true,
          failureCount: true,
        },
      });

    return this.send(subscriptions, payload);
  }

  /** Push to every device belonging to a single user. */
  async sendToUser(userId: string, payload: PushPayload) {
    const subscriptions =
      await this.prismaService.tenancy.pushSubscription.findMany({
        where: { userId },
        select: {
          id: true,
          endpoint: true,
          p256dh: true,
          auth: true,
          failureCount: true,
        },
      });

    return this.send(subscriptions, payload);
  }

  /**
   * Delivers `payload` to each subscription, pruning the ones the push service
   * reports as gone. Never throws - a failed notification must not take down
   * the business operation that triggered it.
   */
  private async send(
    subscriptions: StoredSubscription[],
    payload: PushPayload,
  ): Promise<{ sent: number; failed: number; removed: number }> {
    const result = { sent: 0, failed: 0, removed: 0 };

    if (!this.enabled || !subscriptions.length) {
      return result;
    }

    const body = JSON.stringify(payload);
    const expired: string[] = [];
    const failed: string[] = [];
    const succeeded: string[] = [];

    for (let i = 0; i < subscriptions.length; i += PUSH_BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + PUSH_BATCH_SIZE);

      await Promise.all(
        batch.map(async (subscription) => {
          try {
            await webPush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              body,
              { TTL: 60 * 60 * 24 },
            );
            succeeded.push(subscription.id);
          } catch (error) {
            const statusCode = (error as webPush.WebPushError)?.statusCode;

            // 404 Not Found / 410 Gone - the browser dropped the subscription.
            if (statusCode === 404 || statusCode === 410) {
              expired.push(subscription.id);
              return;
            }

            if (subscription.failureCount + 1 >= MAX_PUSH_FAILURES) {
              expired.push(subscription.id);
            } else {
              failed.push(subscription.id);
            }

            this.logger.warn(
              `Push delivery failed (status ${statusCode ?? 'unknown'}): ${
                (error as Error).message
              }`,
            );
          }
        }),
      );
    }

    result.sent = succeeded.length;
    result.failed = failed.length + expired.length;
    result.removed = expired.length;

    await this.reconcile({ succeeded, failed, expired });

    return result;
  }

  private async reconcile({
    succeeded,
    failed,
    expired,
  }: {
    succeeded: string[];
    failed: string[];
    expired: string[];
  }) {
    const prisma = this.prismaService.tenancy;

    try {
      await Promise.all([
        succeeded.length
          ? prisma.pushSubscription.updateMany({
              where: { id: { in: succeeded } },
              data: { failureCount: 0, lastSuccessAt: new Date() },
            })
          : null,
        failed.length
          ? prisma.pushSubscription.updateMany({
              where: { id: { in: failed } },
              data: { failureCount: { increment: 1 } },
            })
          : null,
        expired.length
          ? prisma.pushSubscription.deleteMany({
              where: { id: { in: expired } },
            })
          : null,
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to reconcile push subscription state: ${(error as Error).message}`,
      );
    }
  }
}
