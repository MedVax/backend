import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import {
  Logger,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Job } from 'bullmq';
import { addWeeks, addMonths, format } from 'date-fns';
import { randomUUID } from 'crypto';

import { RECURRING_ORDERS } from 'constants/queue.constant';
import {
  PROCESS_RECURRING_ORDER,
  RETRY_RECURRING_PAYMENT,
} from 'constants/job.constant';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { OrdersService } from '../services/orders.service';
import { PaystackService } from 'modules/services/paystack-service';
import { StockService } from 'modules/stock/services/stock.service';
import { OrderRecurringFrequency } from 'generated/prisma/enums';
import { MailService } from 'src/mail/services/mail.service';
import { TransactionsService } from 'modules/transactions/services/transactions.service';
import { TransactionType } from 'generated/prisma/enums';

@Processor(RECURRING_ORDERS)
@Injectable()
export class RecurringOrdersProcessor extends WorkerHost {
  private logger = new Logger(RecurringOrdersProcessor.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private ordersService: OrdersService,
    private paystackService: PaystackService,
    private stockService: StockService,
    private mailService: MailService,
    @Inject(forwardRef(() => TransactionsService))
    private transactionsService: TransactionsService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing recurring order job: ${job.name} - ${job.id}`);

    try {
      switch (job.name) {
        case PROCESS_RECURRING_ORDER:
          await this.processRecurringOrder(job);
          break;
        case RETRY_RECURRING_PAYMENT:
          await this.retryRecurringPayment(job);
          break;
        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing recurring order job ${job.name}: ${error.message}`,
      );
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Recurring order job active: ${job.name} - ${job.id}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Recurring order job completed: ${job.name} - ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Recurring order job failed: ${job.name} - ${job.id} - ${error.message}`,
    );
  }

  /**
   * Process a recurring order - create a new order based on the parent order
   */
  private async processRecurringOrder(job: Job<{ orderId: string }>) {
    const { orderId } = job.data;

    const parentOrder = await this.prismaService.tenancy.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        deliveryAddress: true,
      },
    });

    if (!parentOrder) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (!parentOrder.isRecurring || !parentOrder.isRecurringActive) {
      this.logger.warn(
        `Order ${orderId} is not recurring or not active. Skipping.`,
      );
      return;
    }

    if (!parentOrder.user) {
      this.logger.warn(
        `Order ${orderId} has no associated user. Skipping recurring order creation.`,
      );
      return;
    }

    // Check if payment was successful on the parent order
    if (parentOrder.paymentStatus !== 'PAID') {
      this.logger.warn(
        `Order ${orderId} payment status is not PAID. Initiating payment retry.`,
      );
      // Trigger payment retry
      await this.retryPaymentForOrder(parentOrder);
      return;
    }

    // Create new order items from parent order
    const orderItems = parentOrder.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const orderReference = `ORD-${Date.now()}-${randomUUID().split('-')[0]}`;

    // Reserve stock for all items
    for (const item of orderItems) {
      await this.stockService.reserveStock(
        item.productId,
        item.quantity,
        orderReference,
        `Reserve for recurring order`,
      );
    }

    // Calculate next run date
    const now = new Date();
    let nextRunDate: Date | null = null;
    if (parentOrder.recurringFrequency === OrderRecurringFrequency.WEEKLY) {
      nextRunDate = addWeeks(now, 1);
    } else if (
      parentOrder.recurringFrequency === OrderRecurringFrequency.MONTHLY
    ) {
      nextRunDate = addMonths(now, 1);
    }

    try {
      // Create new recurring order
      const newOrder = await this.prismaService.tenancy.$transaction(
        async (tx) => {
          const created = await tx.order.create({
            data: {
              userId: parentOrder.userId,
              deliveryAddressId: parentOrder.deliveryAddressId,
              // Copy guest info if it's a guest order
              guestFirstName: parentOrder.guestFirstName,
              guestLastName: parentOrder.guestLastName,
              guestEmail: parentOrder.guestEmail,
              guestPhone: parentOrder.guestPhone,
              guestAddressLine1: parentOrder.guestAddressLine1,
              guestAddressLine2: parentOrder.guestAddressLine2,
              guestCity: parentOrder.guestCity,
              guestState: parentOrder.guestState,
              guestPostalCode: parentOrder.guestPostalCode,
              guestCountry: parentOrder.guestCountry,
              totalAmount,
              currency: parentOrder.currency,
              paymentStatus: 'PENDING',
              orderStatus: 'PENDING',
              notes: `Recurring order from ${parentOrder.id}`,
              isRecurring: true,
              recurringFrequency: parentOrder.recurringFrequency,
              nextRunDate,
              paymentRetryCount: 0,
              isRecurringActive: true,
              items: {
                create: orderItems,
              },
            },
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          });

          // Update parent order's nextRunDate and reset retry count
          await tx.order.update({
            where: { id: orderId },
            data: {
              nextRunDate,
              paymentRetryCount: 0, // Reset retry count for successful order
            },
          });

          return created;
        },
      );

      // Try to charge the customer for the new order
      // For now, we'll initialize payment similar to the create order flow
      // In production, you'd use saved payment authorization code for auto-charge
      if (parentOrder.user) {
        try {
          const [transaction] = await this.paystackService.initBilling({
            reference: orderReference,
            customer: {
              email: parentOrder.user.email,
              firstName: parentOrder.user.firstName || '',
              lastName: parentOrder.user.lastName || '',
            },
            amount: totalAmount / 100, // Convert from kobo to naira
            currencyCode: 'NGN',
            metadata: {
              orderId: newOrder.id,
              userId: parentOrder.userId,
              isRecurring: true,
              parentOrderId: orderId,
            },
            returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${newOrder.id}`,
          });

          const providerReference = transaction.reference || orderReference;

          await this.prismaService.tenancy.order.update({
            where: { id: newOrder.id },
            data: {
              paymentReference: providerReference,
              paymentProvider: 'paystack',
            },
          });

          // Create transaction record for recurring order
          try {
            await this.transactionsService.create({
              userId: parentOrder.userId,
              type: TransactionType.RECURRING_ORDER,
              reference: newOrder.id,
              providerReference,
              provider: 'paystack',
              amount: totalAmount,
              currency: 'NGN',
              description: `Recurring payment for order ${newOrder.id}`,
              orderId: newOrder.id,
              metadata: {
                isRecurring: true,
                parentOrderId: orderId,
              },
              providerResponse: transaction,
              customerEmail: parentOrder.user.email,
              customerName:
                `${parentOrder.user.firstName || ''} ${parentOrder.user.lastName || ''}`.trim(),
            });
          } catch (error) {
            this.logger.error(
              `Failed to create transaction record for recurring order: ${error.message}`,
            );
            // Don't throw - transaction creation failure shouldn't break recurring order
          }

          this.logger.log(
            `Recurring order ${newOrder.id} created and payment initialized`,
          );
        } catch (paymentError) {
          this.logger.error(
            `Failed to initialize payment for recurring order ${newOrder.id}: ${paymentError.message}`,
          );
          // Payment initialization failed, will be retried
          await this.retryPaymentForOrder(newOrder);
        }
      }

      // Send email notification for recurring order creation
      if (parentOrder.user) {
        try {
          const itemsSummary = newOrder.items
            .map(
              (item: any) =>
                `${item.product.name} (x${item.quantity}) - ₦${(
                  (item.unitPrice * item.quantity) /
                  100
                ).toFixed(2)}`,
            )
            .join('\n');

          const totalAmount = `₦${(newOrder.totalAmount / 100).toFixed(2)}`;
          const frequency =
            parentOrder.recurringFrequency === OrderRecurringFrequency.WEEKLY
              ? 'weekly'
              : 'monthly';
          const nextDeliveryDate = nextRunDate
            ? format(nextRunDate, 'PPP')
            : 'N/A';

          await this.mailService.recurringOrderCreated({
            to: parentOrder.user.email,
            context: {
              firstName: parentOrder.user.firstName || 'Customer',
              lastName: parentOrder.user.lastName || '',
              orderId: newOrder.id,
              frequency,
              nextDeliveryDate,
              itemsSummary,
              totalAmount,
              supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
            },
          });

          this.logger.log(
            `Recurring order creation email sent to ${parentOrder.user.email} for order ${newOrder.id}`,
          );
        } catch (emailError) {
          this.logger.error(
            `Failed to send recurring order creation email: ${emailError.message}`,
          );
          // Don't throw - we don't want to fail recurring order creation if email fails
        }
      }

      this.logger.log(`Recurring order processed successfully: ${newOrder.id}`);
    } catch (error) {
      // Release reserved stock on error
      for (const item of orderItems) {
        try {
          await this.stockService.releaseStock(
            item.productId,
            item.quantity,
            orderReference,
            `Release stock due to recurring order creation failure`,
          );
        } catch (releaseError) {
          this.logger.error(
            `Failed to release stock for product ${item.productId}: ${releaseError.message}`,
          );
        }
      }
      throw error;
    }
  }

  /**
   * Retry payment for a recurring order
   */
  private async retryRecurringPayment(job: Job<{ orderId: string }>) {
    const { orderId } = job.data;

    const order = await this.prismaService.tenancy.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    await this.retryPaymentForOrder(order);
  }

  /**
   * Helper method to retry payment for an order
   */
  private async retryPaymentForOrder(order: any) {
    if (!order.isRecurring || !order.isRecurringActive) {
      return;
    }

    const retryCount = order.paymentRetryCount || 0;

    if (retryCount >= 3) {
      // Cancel recurring order permanently
      await this.prismaService.tenancy.order.update({
        where: { id: order.id },
        data: {
          isRecurringActive: false,
        },
      });

      // Send cancellation email
      if (order.user) {
        await this.mailService.recurringOrderCancelled({
          to: order.user.email,
          subject: 'Recurring Order Cancelled',
          context: {
            firstName: order.user.firstName || 'Customer',
            orderId: order.id,
            orderDate: format(new Date(order.createdAt), 'PPP'),
            supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
          },
        });
      }

      this.logger.log(
        `Recurring order ${order.id} cancelled after 3 payment retry failures`,
      );
      return;
    }

    // Increment retry count
    await this.prismaService.tenancy.order.update({
      where: { id: order.id },
      data: {
        paymentRetryCount: retryCount + 1,
      },
    });

    // Send payment failure notification
    if (order.user) {
      await this.mailService.recurringPaymentFailure({
        to: order.user.email,
        subject: 'Payment Failed for Recurring Order',
        context: {
          firstName: order.user.firstName || 'Customer',
          orderId: order.id,
          orderDate: format(new Date(order.createdAt), 'PPP'),
          retryCount: retryCount + 1,
          maxRetries: 3,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
        },
      });
    }

    this.logger.log(
      `Payment retry ${retryCount + 1}/3 initiated for recurring order ${order.id}`,
    );
  }
}
