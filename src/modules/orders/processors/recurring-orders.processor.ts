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
import { TransactionType, TransactionStatus } from 'generated/prisma/enums';

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

      // Charge the customer for the new recurring order
      // Production implementation: Use saved authorization code for automatic charging
      if (parentOrder.user) {
        try {
          // Step 1: Try to find a saved authorization code from previous successful payments
          const savedAuthorization =
            await this.prismaService.tenancy.transaction.findFirst({
              where: {
                userId: parentOrder.userId,
                provider: 'paystack',
                authorizationCode: { not: null },
                status: TransactionStatus.SUCCESS,
                // Only use authorization codes from successful orders (not sessions)
                orderId: { not: null },
              },
              orderBy: {
                completedAt: 'desc', // Use most recent successful authorization
              },
              select: {
                authorizationCode: true,
                customerEmail: true,
              },
            });

          let paymentResult: any;
          let providerReference = orderReference;
          const paymentInitialized = false;

          // Step 2: If authorization code exists, attempt automatic charge
          if (savedAuthorization?.authorizationCode) {
            this.logger.log(
              `Attempting automatic charge for recurring order ${newOrder.id} using saved authorization`,
            );

            try {
              paymentResult = await this.paystackService.chargeBillingMethod({
                reference: orderReference,
                authorizationCode: savedAuthorization.authorizationCode,
                customer: {
                  email: parentOrder.user.email,
                  firstName: parentOrder.user.firstName || '',
                  lastName: parentOrder.user.lastName || '',
                },
                amount: totalAmount,
                currencyCode: 'NGN',
                description: `Recurring payment for order ${newOrder.id}`,
                metadata: {
                  orderId: newOrder.id,
                  userId: parentOrder.userId,
                  isRecurring: true,
                  parentOrderId: orderId,
                  autoCharged: true,
                },
              });

              providerReference = paymentResult.reference || orderReference;

              // Verify the charge was successful
              const verifiedTransaction =
                await this.paystackService.confirmBillingMethodCharge(
                  providerReference,
                );

              if (verifiedTransaction.status === 'success') {
                // Payment successful - update order status
                await this.prismaService.tenancy.order.update({
                  where: { id: newOrder.id },
                  data: {
                    paymentStatus: 'PAID',
                    paymentReference: providerReference,
                    paymentProvider: 'paystack',
                    orderStatus: 'ACCEPTED',
                  },
                });

                // Create successful transaction record
                const transactionRecord = await this.transactionsService.create(
                  {
                    userId: parentOrder.userId,
                    type: TransactionType.RECURRING_ORDER,
                    reference: newOrder.id,
                    providerReference,
                    provider: 'paystack',
                    amount: totalAmount,
                    currency: 'NGN',
                    description: `Recurring payment for order ${newOrder.id}`,
                    orderId: newOrder.id,
                    authorizationCode:
                      verifiedTransaction.authorization?.authorization_code ||
                      savedAuthorization.authorizationCode,
                    metadata: {
                      isRecurring: true,
                      parentOrderId: orderId,
                      autoCharged: true,
                    },
                    providerResponse: verifiedTransaction,
                    customerEmail: parentOrder.user.email,
                    customerName:
                      `${parentOrder.user.firstName || ''} ${parentOrder.user.lastName || ''}`.trim(),
                  },
                );

                // Update transaction status to SUCCESS
                await this.transactionsService.update(transactionRecord.id, {
                  status: TransactionStatus.SUCCESS,
                  completedAt: new Date(),
                  authorizationCode:
                    verifiedTransaction.authorization?.authorization_code ||
                    savedAuthorization.authorizationCode,
                });

                this.logger.log(
                  `Recurring order ${newOrder.id} automatically charged successfully using saved authorization`,
                );

                // Send success email
                try {
                  await this.mailService.recurringOrderCreated({
                    to: parentOrder.user.email,
                    context: {
                      firstName: parentOrder.user.firstName || 'Customer',
                      lastName: parentOrder.user.lastName || '',
                      orderId: newOrder.id,
                      frequency:
                        parentOrder.recurringFrequency ===
                        OrderRecurringFrequency.WEEKLY
                          ? 'weekly'
                          : 'monthly',
                      nextDeliveryDate: nextRunDate
                        ? format(nextRunDate, 'PPP')
                        : 'N/A',
                      itemsSummary: newOrder.items
                        .map(
                          (item: any) =>
                            `${item.product.name} (x${item.quantity}) - ₦${(
                              (item.unitPrice * item.quantity) /
                              100
                            ).toFixed(2)}`,
                        )
                        .join('\n'),
                      totalAmount: `₦${(newOrder.totalAmount / 100).toFixed(2)}`,
                      supportEmail:
                        process.env.SUPPORT_EMAIL || 'support@medvax.com',
                    },
                  });
                } catch (emailError) {
                  this.logger.error(
                    `Failed to send recurring order success email: ${emailError.message}`,
                  );
                }

                return; // Success - exit early
              } else {
                throw new Error(
                  `Payment verification failed: ${verifiedTransaction.gateway_response || 'Unknown error'}`,
                );
              }
            } catch (chargeError: any) {
              this.logger.warn(
                `Automatic charge failed for recurring order ${newOrder.id}: ${chargeError.message}. Falling back to payment link.`,
              );
              // Fall through to initialize payment link
            }
          }

          // Step 3: Fallback - Initialize payment link if no authorization or charge failed
          if (!paymentInitialized) {
            this.logger.log(
              `Initializing payment link for recurring order ${newOrder.id} (no saved authorization or charge failed)`,
            );

            // PaystackService expects amount in Naira and converts to kobo internally
            // totalAmount is in kobo, so we need to convert to Naira first
            const amountInNaira = totalAmount / 100;

            const [transaction, paymentLink] =
              await this.paystackService.initBilling({
                reference: orderReference,
                customer: {
                  email: parentOrder.user.email,
                  firstName: parentOrder.user.firstName || '',
                  lastName: parentOrder.user.lastName || '',
                },
                amount: amountInNaira, // Amount in Naira (PaystackService will convert to kobo)
                currencyCode: 'NGN',
                metadata: {
                  orderId: newOrder.id,
                  userId: parentOrder.userId,
                  isRecurring: true,
                  parentOrderId: orderId,
                },
                returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${newOrder.id}`,
              });

            providerReference = transaction.reference || orderReference;

            await this.prismaService.tenancy.order.update({
              where: { id: newOrder.id },
              data: {
                paymentReference: providerReference,
                paymentProvider: 'paystack',
                // Store payment link in metadata for reference
                notes:
                  `${newOrder.notes || ''}\nPayment link: ${paymentLink.authorization_url}`.trim(),
              },
            });

            // Create pending transaction record
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
                paymentLink: paymentLink.authorization_url,
              },
              providerResponse: transaction,
              providerMetadata: {
                paymentLink: paymentLink.authorization_url,
              },
              customerEmail: parentOrder.user.email,
              customerName:
                `${parentOrder.user.firstName || ''} ${parentOrder.user.lastName || ''}`.trim(),
            });

            // Send email with payment link
            try {
              await this.mailService.recurringOrderCreated({
                to: parentOrder.user.email,
                context: {
                  firstName: parentOrder.user.firstName || 'Customer',
                  lastName: parentOrder.user.lastName || '',
                  orderId: newOrder.id,
                  frequency:
                    parentOrder.recurringFrequency ===
                    OrderRecurringFrequency.WEEKLY
                      ? 'weekly'
                      : 'monthly',
                  nextDeliveryDate: nextRunDate
                    ? format(nextRunDate, 'PPP')
                    : 'N/A',
                  itemsSummary: newOrder.items
                    .map(
                      (item: any) =>
                        `${item.product.name} (x${item.quantity}) - ₦${(
                          (item.unitPrice * item.quantity) /
                          100
                        ).toFixed(2)}`,
                    )
                    .join('\n'),
                  totalAmount: `₦${(newOrder.totalAmount / 100).toFixed(2)}`,
                  paymentLink: paymentLink.authorization_url,
                  supportEmail:
                    process.env.SUPPORT_EMAIL || 'support@medvax.com',
                },
              });
            } catch (emailError) {
              this.logger.error(
                `Failed to send recurring order payment link email: ${emailError.message}`,
              );
            }

            this.logger.log(
              `Recurring order ${newOrder.id} created and payment link initialized`,
            );
          }
        } catch (paymentError: any) {
          this.logger.error(
            `Failed to process payment for recurring order ${newOrder.id}: ${paymentError.message}`,
            paymentError.stack,
          );
          // Payment processing failed, will be retried
          await this.retryPaymentForOrder(newOrder);
        }
      }

      // Email notifications are sent within the payment processing block above
      // - Success email sent when automatic charge succeeds
      // - Payment link email sent when payment link is initialized
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
