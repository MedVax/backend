import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { addDays, format, startOfDay } from 'date-fns';

import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { MailService } from 'src/mail/services/mail.service';
import { RECURRING_ORDERS } from 'constants/queue.constant';
import {
  PROCESS_RECURRING_ORDER,
  RETRY_RECURRING_PAYMENT,
} from 'constants/job.constant';

@Injectable()
export class RecurringOrdersScheduler {
  private readonly logger = new Logger(RecurringOrdersScheduler.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private mailService: MailService,
    @InjectQueue(RECURRING_ORDERS)
    private recurringOrdersQueue: Queue,
  ) {}

  /**
   * Check for recurring orders due in 1 day and send reminder emails
   * Runs daily at 9 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendRecurringOrderReminders() {
    this.logger.log('Checking for recurring orders due in 1 day...');

    try {
      const tomorrow = addDays(startOfDay(new Date()), 1);

      const ordersDueTomorrow = await this.prismaService.tenancy.order.findMany(
        {
          where: {
            isRecurring: true,
            isRecurringActive: true,
            nextRunDate: {
              gte: startOfDay(tomorrow),
              lt: addDays(startOfDay(tomorrow), 1),
            },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    price: true,
                  },
                },
              },
            },
          },
        },
      );

      this.logger.log(
        `Found ${ordersDueTomorrow.length} recurring orders due tomorrow`,
      );

      for (const order of ordersDueTomorrow) {
        if (order.user) {
          const itemsSummary = order.items
            .map(
              (item) =>
                `${item.product.name} (x${item.quantity}) - ₦${(
                  (item.unitPrice * item.quantity) /
                  100
                ).toFixed(2)}`,
            )
            .join('\n');

          const totalAmount = order.items.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0,
          );

          await this.mailService.recurringOrderReminder({
            to: order.user.email,
            subject: 'Reminder: Your Recurring Order is Due Tomorrow',
            context: {
              firstName: order.user.firstName ?? 'Customer',
              orderId: order.id,
              nextDeliveryDate: format(order.nextRunDate, 'PPP'),
              itemsSummary,
              totalAmount: `₦${(totalAmount / 100).toFixed(2)}`,
              frequency:
                order.recurringFrequency === 'WEEKLY' ? 'weekly' : 'monthly',
              supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
            },
          });

          this.logger.log(
            `Reminder email sent for recurring order ${order.id}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error sending recurring order reminders: ${error.message}`,
      );
    }
  }

  /**
   * Process recurring orders that are due today
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processDueRecurringOrders() {
    this.logger.log('Checking for recurring orders due today...');

    try {
      const now = new Date();
      const today = startOfDay(now);
      const tomorrow = addDays(today, 1);

      const ordersDueToday = await this.prismaService.tenancy.order.findMany({
        where: {
          isRecurring: true,
          isRecurringActive: true,
          nextRunDate: {
            gte: today,
            lt: tomorrow,
          },
          paymentStatus: 'PAID', // Only process orders with successful payment
        },
        select: {
          id: true,
        },
      });

      this.logger.log(
        `Found ${ordersDueToday.length} recurring orders due today`,
      );

      for (const order of ordersDueToday) {
        await this.recurringOrdersQueue.add(PROCESS_RECURRING_ORDER, {
          orderId: order.id,
        });

        this.logger.log(`Queued recurring order ${order.id} for processing`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing due recurring orders: ${error.message}`,
      );
    }
  }

  /**
   * Retry failed payments for recurring orders
   * Runs every 6 hours
   */
  @Cron('0 */6 * * *')
  async retryFailedRecurringPayments() {
    this.logger.log('Checking for recurring orders with failed payments...');

    try {
      const ordersWithFailedPayments =
        await this.prismaService.tenancy.order.findMany({
          where: {
            isRecurring: true,
            isRecurringActive: true,
            paymentStatus: {
              in: ['PENDING', 'FAILED'],
            },
            paymentRetryCount: {
              lt: 3,
            },
          },
          select: {
            id: true,
            paymentRetryCount: true,
          },
        });

      this.logger.log(
        `Found ${ordersWithFailedPayments.length} recurring orders with failed payments`,
      );

      for (const order of ordersWithFailedPayments) {
        await this.recurringOrdersQueue.add(RETRY_RECURRING_PAYMENT, {
          orderId: order.id,
        });

        this.logger.log(`Queued payment retry for recurring order ${order.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Error retrying failed recurring payments: ${error.message}`,
      );
    }
  }
}
