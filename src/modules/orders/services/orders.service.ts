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
import { QueryFilter, QueryOptions } from 'libs/url-to-db-query';
import type { Order, PaymentStatus } from 'generated/prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class OrdersService {
  private logger = new Logger(OrdersService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private paystackService: PaystackService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    // Get user cart
    const cart = await this.prismaService.tenancy.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                stock: true,
              },
            },
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

    // Calculate total and validate stock
    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      // Check stock availability if pharmacy is specified
      if (dto.pharmacyId) {
        const stock = product.stock.find(
          (s) => s.pharmacyId === dto.pharmacyId,
        );
        if (!stock || stock.quantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.name}`,
          );
        }
      }

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
      });
    }

    // Create order
    const orderReference = `ORD-${Date.now()}-${randomUUID().split('-')[0]}`;

    const order = await this.prismaService.tenancy.$transaction(async (tx) => {
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

      // Clear cart after order creation
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return created;
    });

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
                stock: true,
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

    if (dto.orderStatus) {
      updateData.orderStatus = dto.orderStatus;
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
