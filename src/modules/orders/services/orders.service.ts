import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { UpdateOrderStatusDto } from '../dtos/update-order-status.dto';
import {
  PaystackService,
  ALL_PAYSTACK_CHANNELS,
} from 'modules/services/paystack-service';
import { StockService } from 'modules/stock/services/stock.service';
import type { PaymentStatus, Prisma } from 'generated/prisma/client';
import {
  OrderRecurringFrequency,
  UserProfileType,
} from 'generated/prisma/enums';
import { randomUUID } from 'crypto';
import { addWeeks, addMonths } from 'date-fns';
import { MailService } from 'src/mail/services/mail.service';
import { format } from 'date-fns';
import { TransactionsService } from 'modules/transactions/services/transactions.service';
import { TransactionType, TransactionStatus } from 'generated/prisma/enums';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { GetOrdersFilterQuery } from '../dtos/get-orders-filter-query.dto';
import { isArray } from 'class-validator';
import { DeliveryFeeService } from './delivery-fee.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFICATION_EVENTS } from 'modules/notifications/constants/notifications.constant';
import {
  OrderCreatedEvent,
  OrderPaidEvent,
} from 'modules/notifications/events/notifications.event';

@Injectable()
export class OrdersService {
  private logger = new Logger(OrdersService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private paystackService: PaystackService,
    private stockService: StockService,
    private deliveryFeeService: DeliveryFeeService,
    @Inject(forwardRef(() => MailService))
    private mailService: MailService,
    @Inject(forwardRef(() => TransactionsService))
    private transactionsService: TransactionsService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    userId: string | undefined,
    sessionId: string | undefined,
    dto: CreateOrderDto,
  ) {
    // Validate that either userId or sessionId is provided
    if (!userId && !sessionId) {
      throw new BadRequestException(
        'Either userId or sessionId must be provided',
      );
    }

    // For anonymous checkout, guestInfo is required
    if (!userId && !dto.guestInfo) {
      throw new BadRequestException(
        'Guest information is required for anonymous checkout',
      );
    }

    // For authenticated checkout, deliveryAddressId is required
    if (userId && !dto.deliveryAddressId) {
      throw new BadRequestException(
        'Delivery address is required for authenticated checkout',
      );
    }

    this.logger.log(
      `Order creation initiated - User: ${userId || 'Anonymous'}, SessionId: ${sessionId || 'N/A'}, DeliveryAddress: ${dto.deliveryAddressId || 'Guest Address'}`,
    );

    // Get cart by userId or sessionId
    const cart = await this.prismaService.tenancy.cart.findUnique({
      where: userId ? { userId } : { sessionId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      this.logger.warn(
        `Order creation failed: empty cart - User: ${userId || 'Anonymous'}, SessionId: ${sessionId || 'N/A'}`,
      );
      throw new BadRequestException('Cart is empty');
    }

    // Verify delivery address for authenticated users
    let address = null;
    if (userId && dto.deliveryAddressId) {
      address = await this.prismaService.tenancy.address.findFirst({
        where: { id: dto.deliveryAddressId, userId },
      });

      if (!address) {
        throw new NotFoundException('Delivery address not found');
      }
    }

    // Check if any products require prescription
    // const requiresPrescription = cart.items.some(
    //   (item) => item.product.requiresPrescription,
    // );

    // if (requiresPrescription) {
    //   if (!dto.prescriptionUploads || dto.prescriptionUploads.length === 0) {
    //     throw new BadRequestException(
    //       'Prescription uploads required for prescription-only products',
    //     );
    //   }
    // }

    // Calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      // Validate stock availability
      const stockValidation = await this.stockService.validateStock([
        { productId: product.id, quantity: item.quantity },
      ]);

      const validation = stockValidation[0];
      if (validation.available < validation.requested) {
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}. Available: ${validation.available}, Requested: ${validation.requested}`,
        );
      }

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
      });
    }

    // Calculate delivery fee (same-day delivery)
    let deliveryFee = 0;
    if (dto.deliveryFee !== undefined) {
      // Use provided delivery fee from frontend
      deliveryFee = dto.deliveryFee;
    } else {
      // Calculate delivery fee
      const city = address?.city || dto.guestInfo?.city;
      const state = address?.state || dto.guestInfo?.state;
      deliveryFee = this.deliveryFeeService.calculateDeliveryFee(
        totalAmount,
        city,
        state,
      );
    }

    // Add delivery fee to total amount
    const finalTotalAmount = totalAmount + deliveryFee;

    this.logger.log(
      `Order totals calculated - Subtotal: ${totalAmount}, Delivery Fee: ${deliveryFee}, Final Total: ${finalTotalAmount}`,
    );

    // Reserve stock for all items
    const orderReference = `ORD-${Date.now()}-${randomUUID().split('-')[0]}`;

    for (const item of orderItems) {
      await this.stockService.reserveStock(
        item.productId,
        item.quantity,
        orderReference,
        `Reserve for order creation`,
      );
    }

    let orderResult: { order: any; recurringOrder: any | null } | null = null;

    try {
      orderResult = await this.prismaService.tenancy.$transaction(
        async (tx) => {
          let recurringOrder: any = null;

          // Create the original order (one-time order, even if isRecurring is true)
          const created = await tx.order.create({
            data: {
              userId: userId || null,
              deliveryAddressId: dto.deliveryAddressId || null,
              // Guest information for anonymous orders
              guestFirstName: dto.guestInfo?.firstName,
              guestLastName: dto.guestInfo?.lastName,
              guestEmail: dto.guestInfo?.email,
              guestPhone: dto.guestInfo?.phone,
              guestAddressLine1: dto.guestInfo?.addressLine1,
              guestAddressLine2: dto.guestInfo?.addressLine2,
              guestCity: dto.guestInfo?.city,
              guestState: dto.guestInfo?.state,
              guestPostalCode: dto.guestInfo?.postalCode,
              guestCountry: dto.guestInfo?.country || 'Nigeria',
              totalAmount: finalTotalAmount,
              deliveryFee,
              currency: 'NGN',
              paymentStatus: 'PENDING',
              orderStatus: 'PENDING',
              prescriptionStatus: null,
              notes: dto.notes,
              isRecurring: false, // Original order is always one-time
              isRecurringActive: false,
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
              deliveryAddress: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          });

          // Create prescriptions if provided
          if (dto.prescriptionUploads && dto.prescriptionUploads.length > 0) {
            await Promise.all(
              dto.prescriptionUploads.map((url) =>
                tx.prescription.create({
                  data: {
                    orderId: created.id,
                    userId,
                    uploadedBy: userId,
                    fileUrl: url,
                    status: 'PENDING',
                  },
                }),
              ),
            );
          }

          // Update stock movements with actual order ID
          await tx.stockMovement.updateMany({
            where: {
              orderId: null,
              productId: { in: orderItems.map((i) => i.productId) },
              createdAt: { gte: new Date(Date.now() - 5000) }, // Last 5 seconds
            },
            data: {
              orderId: created.id,
              reason: `Reserve for order ${created.id}`,
            },
          });

          // Clear cart after order creation
          await tx.cartItem.deleteMany({
            where: { cartId: cart.id },
          });

          // If recurring order is requested, create a separate recurring order
          if (dto.isRecurring && dto.recurringFrequency) {
            const now = new Date();
            let nextRunDate: Date | null = null;

            if (dto.recurringFrequency === OrderRecurringFrequency.WEEKLY) {
              nextRunDate = addWeeks(now, 1);
            } else if (
              dto.recurringFrequency === OrderRecurringFrequency.MONTHLY
            ) {
              nextRunDate = addMonths(now, 1);
            }

            // Create recurring order items from original order items
            const recurringOrderItems = orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            }));

            // Create the recurring order (separate from the original order)
            recurringOrder = await tx.order.create({
              data: {
                userId: userId || null,
                deliveryAddressId: dto.deliveryAddressId || null,
                // Guest info for anonymous recurring orders
                guestFirstName: dto.guestInfo?.firstName,
                guestLastName: dto.guestInfo?.lastName,
                guestEmail: dto.guestInfo?.email,
                guestPhone: dto.guestInfo?.phone,
                guestAddressLine1: dto.guestInfo?.addressLine1,
                guestAddressLine2: dto.guestInfo?.addressLine2,
                guestCity: dto.guestInfo?.city,
                guestState: dto.guestInfo?.state,
                guestPostalCode: dto.guestInfo?.postalCode,
                guestCountry: dto.guestInfo?.country || 'Nigeria',
                totalAmount: finalTotalAmount,
                deliveryFee,
                currency: 'NGN',
                paymentStatus: 'PENDING', // Won't charge until next run date
                orderStatus: 'PENDING',
                prescriptionStatus: null,
                notes: `Recurring order created from order ${created.id}`,
                isRecurring: true,
                recurringFrequency: dto.recurringFrequency,
                recurringDate: now, // Track when recurring order was established
                nextRunDate,
                paymentRetryCount: 0,
                isRecurringActive: true,
                items: {
                  create: recurringOrderItems,
                },
              },
              include: {
                items: {
                  include: {
                    product: true,
                  },
                },
                deliveryAddress: true,
              },
            });
          }

          return { order: created, recurringOrder };
        },
      );

      const order = orderResult.order;
      const recurringOrderResult = orderResult.recurringOrder;

      this.logger.log(
        `Order created successfully - ID: ${order.id}, User: ${userId}, Amount: ${order.totalAmount}, Recurring: ${recurringOrderResult ? 'Yes' : 'No'}`,
      );

      // Alert the admin dashboard. Emitted (not awaited) so a notification
      // failure can never roll back or slow down checkout.
      this.eventEmitter.emit(
        NOTIFICATION_EVENTS.ORDER_CREATED,
        new OrderCreatedEvent(
          order.id,
          order.totalAmount,
          order.currency,
          orderItems.length,
          this.resolveCustomerName(order, dto),
          !!recurringOrderResult,
        ),
      );

      // Send email notification if recurring order was created
      if (recurringOrderResult) {
        try {
          const user = userId
            ? await this.prismaService.tenancy.user.findUnique({
                where: { id: userId },
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              })
            : null;

          const email = user?.email || dto.guestInfo?.email;
          const firstName =
            user?.firstName || dto.guestInfo?.firstName || 'Customer';
          const lastName = user?.lastName || dto.guestInfo?.lastName || '';

          if (email) {
            const itemsSummary = recurringOrderResult.items
              .map(
                (item: any) =>
                  `${item.product.name} (x${item.quantity}) - ₦${(
                    item.unitPrice * item.quantity
                  ).toFixed(2)}`,
              )
              .join('\n');

            const totalAmount = `₦${recurringOrderResult.totalAmount.toFixed(2)}`;
            const frequency =
              dto.recurringFrequency === OrderRecurringFrequency.WEEKLY
                ? 'weekly'
                : 'monthly';
            const nextDeliveryDate = recurringOrderResult.nextRunDate
              ? format(new Date(recurringOrderResult.nextRunDate), 'PPP')
              : 'N/A';

            await this.mailService.recurringOrderCreated({
              to: email,
              context: {
                firstName,
                lastName,
                orderId: recurringOrderResult.id,
                frequency,
                nextDeliveryDate,
                itemsSummary,
                totalAmount,
                supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
              },
            });

            this.logger.log(
              `Recurring order creation email sent to ${email} for order ${recurringOrderResult.id}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to send recurring order creation email: ${error.message}`,
          );
          // Don't throw - we don't want to fail order creation if email fails
        }
      }

      // Initialize payment for the original order
      if (dto.paymentMethod === 'paystack') {
        const user = userId
          ? await this.prismaService.tenancy.user.findUnique({
              where: { id: userId },
            })
          : null;

        const customerEmail = user?.email || dto.guestInfo?.email;
        const customerFirstName =
          user?.firstName || dto.guestInfo?.firstName || 'Customer';
        const customerLastName =
          user?.lastName || dto.guestInfo?.lastName || '';

        if (!customerEmail) {
          throw new BadRequestException('Email is required for payment');
        }

        // PaystackService expects amount in Naira and converts to kobo internally
        // finalTotalAmount is in Naira (product prices and delivery fee are stored in Naira)
        const amountInNaira = finalTotalAmount;

        const [transaction, paymentLink] =
          await this.paystackService.initBilling({
            reference: orderReference,
            customer: {
              email: customerEmail,
              firstName: customerFirstName,
              lastName: customerLastName,
            },
            amount: amountInNaira, // Amount in Naira (PaystackService will convert to kobo)
            currencyCode: 'NGN',
            // For one-time orders, accept every channel Paystack offers. When a
            // recurring order is being set up, restrict to card so Paystack
            // returns a reusable authorization code for the automatic charges.
            channels: recurringOrderResult ? ['card'] : ALL_PAYSTACK_CHANNELS,
            metadata: {
              orderId: order.id,
              userId: userId || null,
              sessionId: sessionId || null,
            },
            returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/success?orderId=${order.id}`,
          });

        const providerReference = transaction.reference || orderReference;

        // Update order with payment reference
        await this.prismaService.tenancy.order.update({
          where: { id: order.id },
          data: {
            paymentReference: providerReference,
            paymentProvider: 'paystack',
          },
        });

        // Create transaction record
        try {
          await this.transactionsService.create({
            userId,
            type: TransactionType.ORDER,
            reference: order.id,
            providerReference,
            provider: 'paystack',
            amount: finalTotalAmount,
            currency: 'NGN',
            description: `Payment for order ${order.id}`,
            orderId: order.id,
            metadata: transaction,
            providerResponse: transaction,
            providerMetadata: {
              paymentLink: paymentLink.authorization_url,
            },
            customerEmail: user.email,
            customerName: `${user.firstName} ${user.lastName}`,
            paymentMethod: dto.paymentMethod,
            paymentChannel: paymentLink.channels?.[0],
          });
        } catch (error) {
          this.logger.error(
            `Failed to create transaction record: ${error.message}`,
          );
          // Don't throw - transaction creation failure shouldn't break order creation
        }

        return {
          ...order,
          paymentUrl: paymentLink.authorization_url,
          paymentReference: transaction.reference || orderReference,
          recurringOrder: recurringOrderResult
            ? {
                id: recurringOrderResult.id,
                recurringDate: recurringOrderResult.recurringDate,
                nextRunDate: recurringOrderResult.nextRunDate,
                recurringFrequency: recurringOrderResult.recurringFrequency,
              }
            : null,
        };
      }

      return {
        ...order,
        recurringOrder: recurringOrderResult
          ? {
              id: recurringOrderResult.id,
              recurringDate: recurringOrderResult.recurringDate,
              nextRunDate: recurringOrderResult.nextRunDate,
              recurringFrequency: recurringOrderResult.recurringFrequency,
            }
          : null,
      };
    } catch (error) {
      // Release reserved stock if order creation fails
      for (const item of orderItems) {
        try {
          await this.stockService.releaseStock(
            item.productId,
            item.quantity,
            orderReference,
            `Release due to order creation failure`,
          );
        } catch (releaseError) {
          this.logger.error(
            `Failed to release stock for product ${item.productId}: ${releaseError.message}`,
          );
        }
      }
      this.logger.error(
        `Order creation failed - User: ${userId}, Error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findAll(
    paginationQueryParams: PaginationQuery,
    filterQueryParams: GetOrdersFilterQuery,
    userId?: string,
  ) {
    const {
      search,
      orderStatus,
      paymentStatus,
      prescriptionStatus,
      isRecurring,
      isRecurringActive,
    } = filterQueryParams;

    const where: Prisma.OrderWhereInput = {
      AND: [
        userId ? { userId } : {},
        ...(isRecurring ? [{ isRecurring: true }] : [{ isRecurring: false }]),
        ...(isRecurringActive
          ? [{ isRecurringActive: true }]
          : [{ isRecurringActive: false }]),
        search
          ? {
              OR: [
                { id: { contains: search, mode: 'insensitive' } },
                {
                  user: {
                    OR: [
                      {
                        email: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        firstName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              ],
            }
          : {},
        orderStatus
          ? {
              ...(isArray(orderStatus)
                ? { orderStatus: { in: orderStatus } }
                : { orderStatus }),
            }
          : {},
        paymentStatus
          ? {
              ...(isArray(paymentStatus)
                ? { paymentStatus: { in: paymentStatus } }
                : { paymentStatus }),
            }
          : {},
        prescriptionStatus
          ? {
              ...(isArray(prescriptionStatus)
                ? { prescriptionStatus: { in: prescriptionStatus } }
                : { prescriptionStatus }),
            }
          : {},
      ],
    };

    return this.prismaService.tenancy.order.paginate({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        deliveryAddress: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userProfiles: {
              where: { type: UserProfileType.CLIENT },
              select: {
                id: true,
                userProfileClients: {
                  where: { deletedAt: null },
                  select: { id: true },
                },
              },
            },
          },
        },
        prescriptions: true,
      },
      orderBy: { createdAt: 'desc' },
      ...paginationQueryParams,
    });
  }

  async count(filterQueryParams: GetOrdersFilterQuery, userId?: string) {
    const { search, orderStatus, paymentStatus, prescriptionStatus } =
      filterQueryParams;

    const where: Prisma.OrderWhereInput = {
      AND: [
        userId ? { userId } : {},
        search
          ? {
              OR: [
                { id: { contains: search, mode: 'insensitive' } },
                {
                  user: {
                    OR: [
                      {
                        email: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        firstName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              ],
            }
          : {},
        orderStatus
          ? {
              ...(isArray(orderStatus)
                ? { orderStatus: { in: orderStatus } }
                : { orderStatus }),
            }
          : {},
        paymentStatus
          ? {
              ...(isArray(paymentStatus)
                ? { paymentStatus: { in: paymentStatus } }
                : { paymentStatus }),
            }
          : {},
        prescriptionStatus
          ? {
              ...(isArray(prescriptionStatus)
                ? { prescriptionStatus: { in: prescriptionStatus } }
                : { prescriptionStatus }),
            }
          : {},
      ],
    };

    return this.prismaService.tenancy.order.count({
      where,
    });
  }

  async findOne(id: string, userId?: string) {
    // Allow anonymous users to access orders by ID
    // This is needed for checkout success page after anonymous checkout
    const where: any = { id };
    console.log('userId', userId);

    // if (userId) {
    //   where.userId = userId;
    // }

    const order = await this.prismaService.tenancy.order.findFirst({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        deliveryAddress: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userProfiles: {
              where: { type: UserProfileType.CLIENT },
              select: {
                id: true,
                userProfileClients: {
                  where: { deletedAt: null },
                  select: { id: true },
                },
              },
            },
          },
        },
        prescriptions: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, userId?: string) {
    const order = await this.findOne(id, userId);

    const updateData: any = {};
    const previousStatus = order.orderStatus;

    if (dto.orderStatus) {
      updateData.orderStatus = dto.orderStatus;

      // Handle stock commitment when order is accepted/processing
      if (
        (dto.orderStatus === 'ACCEPTED' || dto.orderStatus === 'PROCESSING') &&
        previousStatus === 'PENDING'
      ) {
        // Commit reserved stock
        for (const item of order.items) {
          await this.stockService.commitStock(
            item.productId,
            item.quantity,
            order.id,
            `Commit stock for order ${order.id} - ${dto.orderStatus}`,
          );
        }
      }

      // Handle stock release when order is cancelled
      if (
        dto.orderStatus === 'CANCELED' &&
        (previousStatus === 'PENDING' ||
          previousStatus === 'ACCEPTED' ||
          previousStatus === 'PROCESSING')
      ) {
        for (const item of order.items) {
          if (previousStatus === 'PENDING') {
            // Just release reserved stock
            await this.stockService.releaseStock(
              item.productId,
              item.quantity,
              order.id,
              `Release reserved stock for cancelled order ${order.id}`,
            );
          } else {
            // Restore committed stock
            await this.stockService.adjustStock(
              item.productId,
              item.quantity,
              `Restore stock from cancelled order ${order.id}`,
            );
          }
        }
      }
    }

    if (dto.paymentStatus) {
      updateData.paymentStatus = dto.paymentStatus;
    }

    const updatedOrder = await this.prismaService.tenancy.order.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        deliveryAddress: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Send email notification if order status or payment status changed
    if (dto.orderStatus || dto.paymentStatus) {
      try {
        const email = updatedOrder.user?.email || updatedOrder.guestEmail;
        const firstName =
          updatedOrder.user?.firstName ||
          updatedOrder.guestFirstName ||
          'Customer';
        const lastName =
          updatedOrder.user?.lastName || updatedOrder.guestLastName || '';

        if (email) {
          const itemsSummary = updatedOrder.items
            .map(
              (item: any) =>
                `${item.product.name} (x${item.quantity}) - ₦${(
                  item.unitPrice * item.quantity
                ).toFixed(2)}`,
            )
            .join('\n');

          const totalAmount = `₦${updatedOrder.totalAmount.toFixed(2)}`;

          await this.mailService.orderStatusUpdated({
            to: email,
            context: {
              firstName,
              lastName,
              orderId: updatedOrder.id,
              previousOrderStatus: previousStatus,
              newOrderStatus: dto.orderStatus || updatedOrder.orderStatus,
              previousPaymentStatus: order.paymentStatus,
              newPaymentStatus: dto.paymentStatus || updatedOrder.paymentStatus,
              itemsSummary,
              totalAmount,
              orderDate: format(new Date(updatedOrder.createdAt), 'PPP'),
              supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
            },
          });

          this.logger.log(
            `Order status update email sent to ${email} for order ${updatedOrder.id}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to send order status update email: ${error.message}`,
        );
        // Don't throw - we don't want to fail status update if email fails
      }
    }

    return updatedOrder;
  }

  async cancel(id: string, userId: string) {
    const order = await this.findOne(id, userId);

    if (order.orderStatus !== 'PENDING' && order.orderStatus !== 'ACCEPTED') {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    const previousStatus = order.orderStatus;

    const updatedOrder = await this.prismaService.tenancy.order.update({
      where: { id },
      data: {
        orderStatus: 'CANCELED',
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Send email notification for order cancellation
    try {
      const email = updatedOrder.user?.email || updatedOrder.guestEmail;
      const firstName =
        updatedOrder.user?.firstName ||
        updatedOrder.guestFirstName ||
        'Customer';
      const lastName =
        updatedOrder.user?.lastName || updatedOrder.guestLastName || '';

      if (email) {
        const itemsSummary = updatedOrder.items
          .map(
            (item: any) =>
              `${item.product.name} (x${item.quantity}) - ₦${(
                item.unitPrice * item.quantity
              ).toFixed(2)}`,
          )
          .join('\n');

        const totalAmount = `₦${updatedOrder.totalAmount.toFixed(2)}`;

        // Generate cancellation message
        const statusMessage =
          '<strong>✗ Order Cancelled</strong> Your order has been cancelled. If you made a payment, you will receive a refund according to our refund policy.';

        await this.mailService.orderStatusUpdated({
          to: email,
          context: {
            firstName,
            lastName,
            orderId: updatedOrder.id,
            previousOrderStatus: previousStatus,
            newOrderStatus: 'CANCELED',
            previousPaymentStatus: order.paymentStatus,
            newPaymentStatus: updatedOrder.paymentStatus,
            itemsSummary,
            totalAmount,
            orderDate: format(new Date(updatedOrder.createdAt), 'PPP'),
            statusMessage,
            statusMessageColor: '#f8d7da',
            statusMessageBorderColor: '#721c24',
            statusMessageTextColor: '#721c24',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
          },
        });

        this.logger.log(
          `Order cancellation email sent to ${email} for order ${updatedOrder.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send order cancellation email: ${error.message}`,
      );
      // Don't throw - we don't want to fail cancellation if email fails
    }

    return updatedOrder;
  }

  async verifyPayment(reference: string) {
    const order = await this.prismaService.tenancy.order.findFirst({
      where: { paymentReference: reference },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found for payment reference');
    }

    // Verify payment with Paystack
    const paystackTransaction =
      await this.paystackService.getBillingMethod(reference);

    const paymentStatus: PaymentStatus =
      paystackTransaction.status === 'success' ? 'PAID' : 'FAILED';

    // Update order payment status
    const updatedOrder = await this.prismaService.tenancy.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        orderStatus: paymentStatus === 'PAID' ? 'ACCEPTED' : order.orderStatus,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update transaction status
    try {
      const transactionStatus =
        paymentStatus === 'PAID'
          ? TransactionStatus.SUCCESS
          : TransactionStatus.FAILED;

      await this.transactionsService.updateByProviderReference(reference, {
        status: transactionStatus,
        metadata: paystackTransaction,
        providerResponse: paystackTransaction,
        // Record the channel the customer actually paid with (card, bank,
        // ussd, bank_transfer, etc.) rather than the initial guess.
        ...(paystackTransaction.channel && {
          paymentChannel: paystackTransaction.channel,
        }),
        webhookEvent:
          transactionStatus === TransactionStatus.SUCCESS
            ? 'charge.success'
            : 'charge.failed',
        webhookPayload: paystackTransaction,
        completedAt:
          transactionStatus === TransactionStatus.SUCCESS
            ? new Date()
            : undefined,
        failedAt:
          transactionStatus === TransactionStatus.FAILED
            ? new Date()
            : undefined,
        ...(paystackTransaction.authorization && {
          authorizationCode:
            paystackTransaction.authorization.authorization_code,
        }),
      });
    } catch (error) {
      this.logger.error(
        `Failed to update transaction record: ${error.message}`,
      );
      // Don't throw - transaction update failure shouldn't break payment verification
    }

    // Send payment confirmation email if payment is successful
    if (paymentStatus === 'PAID') {
      const email = order.user?.email || order.guestEmail;
      const firstName =
        order.user?.firstName || order.guestFirstName || 'Customer';
      const lastName = order.user?.lastName || order.guestLastName || '';

      if (email) {
        const itemsSummary = order.items
          .map(
            (item) =>
              `${item.product.name} (x${item.quantity}) - ₦${(
                item.product.price * item.quantity
              ).toFixed(2)}`,
          )
          .join('\n');

        const totalAmount = `₦${order.totalAmount.toFixed(2)}`;

        try {
          await this.mailService.orderPaymentConfirmed({
            to: email,
            context: {
              firstName,
              lastName,
              orderId: order.id,
              orderDate: format(new Date(order.createdAt), 'PPP'),
              itemsSummary,
              totalAmount,
              paymentReference: reference,
              supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
            },
          });

          this.logger.log(
            `Payment confirmation email sent to ${email} for order ${order.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send payment confirmation email: ${error.message}`,
          );
          // Don't throw - we don't want to fail payment verification if email fails
        }
      }
    }

    if (paymentStatus === 'PAID') {
      this.eventEmitter.emit(
        NOTIFICATION_EVENTS.ORDER_PAID,
        new OrderPaidEvent(
          updatedOrder.id,
          updatedOrder.totalAmount,
          updatedOrder.currency,
          this.resolveCustomerName(updatedOrder),
        ),
      );
    }

    return {
      order: updatedOrder,
    };
  }

  /** Display name for notifications, falling back through guest fields. */
  private resolveCustomerName(
    order: {
      user?: { firstName?: string; lastName?: string } | null;
      guestFirstName?: string | null;
      guestLastName?: string | null;
      guestEmail?: string | null;
    },
    dto?: CreateOrderDto,
  ): string {
    const first =
      order.user?.firstName ||
      order.guestFirstName ||
      dto?.guestInfo?.firstName;
    const last =
      order.user?.lastName || order.guestLastName || dto?.guestInfo?.lastName;

    const name = [first, last].filter(Boolean).join(' ').trim();

    return (
      name || order.guestEmail || dto?.guestInfo?.email || 'Guest customer'
    );
  }

  async handleFailedPayment(
    reference: string,
    webhookEvent: string,
    webhookPayload: any,
    providerResponse: any,
  ) {
    const order = await this.prismaService.tenancy.order.findFirst({
      where: { paymentReference: reference },
    });

    if (!order) {
      throw new NotFoundException('Order not found for payment reference');
    }

    await this.prismaService.tenancy.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED' },
    });

    try {
      await this.transactionsService.updateByProviderReference(reference, {
        status: TransactionStatus.FAILED,
        webhookEvent,
        webhookPayload,
        providerResponse,
        failedAt: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to update transaction record for failed payment: ${error.message}`,
      );
    }
  }

  async resendInvoice(id: string, userId: string) {
    const order = await this.findOne(id, userId);

    // This would trigger email/sms notification with invoice
    // Implementation depends on notification service

    return {
      message: 'Invoice sent successfully',
      order,
    };
  }
}
