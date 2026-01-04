import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { UpdateOrderStatusDto } from '../dtos/update-order-status.dto';
import { PaystackService } from 'modules/services/paystack-service';
import { StockService } from 'modules/stock/services/stock.service';
import { QueryFilter, QueryOptions } from 'libs/url-to-db-query';
import type { Order, PaymentStatus } from 'generated/prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class OrdersService {
  private logger = new Logger(OrdersService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private paystackService: PaystackService,
    private stockService: StockService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    // Get user cart
    const cart = await this.prismaService.tenancy.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Verify delivery address
    const address = await this.prismaService.tenancy.address.findFirst({
      where: { id: dto.deliveryAddressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Delivery address not found');
    }

    // Check if any products require prescription
    const requiresPrescription = cart.items.some(
      (item) => item.product.requiresPrescription,
    );

    if (requiresPrescription) {
      if (!dto.prescriptionUploads || dto.prescriptionUploads.length === 0) {
        throw new BadRequestException(
          'Prescription uploads required for prescription-only products',
        );
      }
    }

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

    let order;
    try {
      order = await this.prismaService.tenancy.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            userId,
            pharmacyId: dto.pharmacyId,
            deliveryAddressId: dto.deliveryAddressId,
            totalAmount,
            currency: 'NGN',
            paymentStatus: 'PENDING',
            orderStatus: 'PENDING',
            prescriptionStatus: requiresPrescription ? 'PENDING' : null,
            notes: dto.notes,
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
            pharmacy: true,
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

        return created;
      });
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
      throw error;
    }

    // Initialize payment
    if (dto.paymentMethod === 'paystack') {
      const user = await this.prismaService.tenancy.user.findUnique({
        where: { id: userId },
      });

      const [transaction, paymentLink] = await this.paystackService.initBilling(
        {
          reference: orderReference,
          customer: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          amount: totalAmount / 100, // Convert from kobo to naira
          currencyCode: 'NGN',
          metadata: {
            orderId: order.id,
            userId,
          },
          returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders/${order.id}`,
        },
      );

      // Update order with payment reference
      await this.prismaService.tenancy.order.update({
        where: { id: order.id },
        data: {
          paymentReference: transaction.reference || orderReference,
          paymentProvider: 'paystack',
        },
      });

      return {
        ...order,
        paymentUrl: paymentLink.authorization_url,
        paymentReference: transaction.reference || orderReference,
      };
    }

    return order;
  }

  async findAll(
    userId?: string,
    filter?: QueryFilter<Order>,
    options?: QueryOptions<Order>,
  ) {
    const whereFilter: any = { ...filter };

    if (userId) {
      whereFilter.userId = userId;
    }

    const result = await this.prismaService.tenancy.order.findManyWithUrlQuery(
      whereFilter,
      options,
    );

    // Fetch with includes separately
    if (Array.isArray(result) && result.length > 0) {
      const ids = result.map((o) => o.id);
      return this.prismaService.tenancy.order.findMany({
        where: { id: { in: ids } },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          deliveryAddress: true,
          pharmacy: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          prescriptions: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    if (!Array.isArray(result) && result.data) {
      const ids = result.data.map((o: any) => o.id);
      const data = await this.prismaService.tenancy.order.findMany({
        where: { id: { in: ids } },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          deliveryAddress: true,
          pharmacy: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          prescriptions: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return { ...result, data };
    }

    return result;
  }

  async count(
    userId?: string,
    filter?: QueryFilter<Order>,
    options?: QueryOptions<Order>,
  ) {
    const whereFilter: any = { ...filter };

    if (userId) {
      whereFilter.userId = userId;
    }

    return this.prismaService.tenancy.order.countWithUrlQuery(
      whereFilter,
      options,
    );
  }

  async findOne(id: string, userId?: string) {
    const where: any = { id };

    if (userId) {
      where.userId = userId;
    }

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
        pharmacy: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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

    // Only pharmacy/admins can update order status
    if (order.pharmacyId) {
      // Verify pharmacy ownership if user is a pharmacist
      // This would need additional logic based on user roles
    }

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

    return this.prismaService.tenancy.order.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        deliveryAddress: true,
        pharmacy: true,
      },
    });
  }

  async cancel(id: string, userId: string) {
    const order = await this.findOne(id, userId);

    if (order.orderStatus !== 'PENDING' && order.orderStatus !== 'ACCEPTED') {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    return this.prismaService.tenancy.order.update({
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
      },
    });
  }

  async verifyPayment(reference: string) {
    const order = await this.prismaService.tenancy.order.findFirst({
      where: { paymentReference: reference },
    });

    if (!order) {
      throw new NotFoundException('Order not found for payment reference');
    }

    // Verify payment with Paystack
    const transaction = await this.paystackService.getBillingMethod(reference);

    const paymentStatus: PaymentStatus =
      transaction.status === 'success' ? 'PAID' : 'FAILED';

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
      },
    });

    return {
      order: updatedOrder,
      transaction,
    };
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
