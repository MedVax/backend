import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebPushService } from '../services/web-push.service';
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_TAGS,
} from '../constants/notifications.constant';
import {
  OrderCreatedEvent,
  OrderPaidEvent,
} from '../events/notifications.event';

@Injectable()
export class OrderPushListener {
  private readonly logger = new Logger(OrderPushListener.name);

  constructor(private readonly webPushService: WebPushService) {}

  @OnEvent(NOTIFICATION_EVENTS.ORDER_CREATED)
  async handleOrderCreated(event: OrderCreatedEvent) {
    const items = `${event.itemCount} item${event.itemCount === 1 ? '' : 's'}`;
    const recurring = event.isRecurring ? ' - recurring' : '';

    await this.dispatch({
      title: 'New order received',
      body: `${event.customerName} - ${formatAmount(
        event.totalAmount,
        event.currency,
      )} (${items})${recurring}`,
      tag: `${NOTIFICATION_TAGS.NEW_ORDER}:${event.orderId}`,
      url: `/orders/${event.orderId}`,
      type: NOTIFICATION_EVENTS.ORDER_CREATED,
      renotify: true,
      requireInteraction: true,
      data: { orderId: event.orderId },
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.ORDER_PAID)
  async handleOrderPaid(event: OrderPaidEvent) {
    await this.dispatch({
      title: 'Order paid',
      body: `${event.customerName} paid ${formatAmount(
        event.totalAmount,
        event.currency,
      )} - ready to fulfil.`,
      tag: `${NOTIFICATION_TAGS.ORDER_PAID}:${event.orderId}`,
      url: `/orders/${event.orderId}`,
      type: NOTIFICATION_EVENTS.ORDER_PAID,
      renotify: true,
      requireInteraction: true,
      data: { orderId: event.orderId },
    });
  }

  /**
   * Notification delivery is best-effort. A push service outage must never
   * surface as a failed checkout, so everything is swallowed and logged.
   */
  private async dispatch(
    payload: Parameters<WebPushService['sendToAdmins']>[0],
  ) {
    try {
      const result = await this.webPushService.sendToAdmins(payload);

      if (result.sent || result.failed) {
        this.logger.log(
          `Order push "${payload.title}": sent ${result.sent}, failed ${result.failed}, pruned ${result.removed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to dispatch order push notification: ${(error as Error).message}`,
      );
    }
  }
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
