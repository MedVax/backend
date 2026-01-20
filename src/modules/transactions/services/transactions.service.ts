import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { TransactionType, TransactionStatus } from 'generated/prisma/enums';
import { QueryFilter, QueryOptions } from 'libs/url-to-db-query';

export interface CreateTransactionDto {
  userId?: string;
  type: TransactionType;
  reference: string; // Internal reference (order ID, session ID, etc.)
  providerReference: string; // Payment provider reference
  provider: string; // paystack, flutterwave, etc.
  amount: number; // Amount in minor currency units
  currency?: string;
  description?: string;
  orderId?: string;
  sessionId?: string;
  metadata?: any; // Full response from payment provider
  providerResponse?: any; // Detailed provider response
  providerMetadata?: any; // Additional provider metadata
  paymentMethod?: string;
  paymentChannel?: string;
  authorizationCode?: string;
  customerCode?: string;
  customerEmail?: string;
  customerName?: string;
  webhookEvent?: string;
  webhookPayload?: any;
}

export interface UpdateTransactionDto {
  status?: TransactionStatus;
  metadata?: any;
  providerResponse?: any;
  providerMetadata?: any;
  webhookEvent?: string;
  webhookPayload?: any;
  authorizationCode?: string;
  errorMessage?: string;
  errorCode?: string;
  completedAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
}

@Injectable()
export class TransactionsService {
  private logger = new Logger(TransactionsService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  /**
   * Create a new transaction record
   */
  async create(dto: CreateTransactionDto) {
    try {
      const transaction = await this.prismaService.tenancy.transaction.create({
        data: {
          userId: dto.userId,
          type: dto.type,
          reference: dto.reference,
          providerReference: dto.providerReference,
          provider: dto.provider,
          amount: dto.amount,
          currency: dto.currency || 'NGN',
          description: dto.description,
          orderId: dto.orderId,
          sessionId: dto.sessionId,
          metadata: dto.metadata,
          providerResponse: dto.providerResponse,
          providerMetadata: dto.providerMetadata,
          paymentMethod: dto.paymentMethod,
          paymentChannel: dto.paymentChannel,
          authorizationCode: dto.authorizationCode,
          customerCode: dto.customerCode,
          customerEmail: dto.customerEmail,
          customerName: dto.customerName,
          webhookEvent: dto.webhookEvent,
          webhookPayload: dto.webhookPayload,
          status: TransactionStatus.PENDING,
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
          order: {
            select: {
              id: true,
              totalAmount: true,
              currency: true,
            },
          },
          session: {
            select: {
              id: true,
              scheduledDate: true,
            },
          },
        },
      });

      this.logger.log(
        `Transaction created: ${transaction.id} for ${dto.type} ${dto.reference}`,
      );

      return transaction;
    } catch (error) {
      this.logger.error(
        `Failed to create transaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update transaction status and details
   */
  async update(id: string, dto: UpdateTransactionDto) {
    const transaction = await this.prismaService.tenancy.transaction.findUnique(
      {
        where: { id },
      },
    );

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    const updateData: any = { ...dto };

    // Set timestamps based on status
    if (dto.status === TransactionStatus.SUCCESS && !transaction.completedAt) {
      updateData.completedAt = new Date();
    }

    if (dto.status === TransactionStatus.FAILED && !transaction.failedAt) {
      updateData.failedAt = new Date();
    }

    if (
      (dto.status === TransactionStatus.REFUNDED ||
        dto.status === TransactionStatus.PARTIALLY_REFUNDED) &&
      !transaction.refundedAt
    ) {
      updateData.refundedAt = new Date();
    }

    const updated = await this.prismaService.tenancy.transaction.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          select: {
            id: true,
            totalAmount: true,
            currency: true,
          },
        },
        session: {
          select: {
            id: true,
            scheduledDate: true,
          },
        },
      },
    });

    this.logger.log(
      `Transaction ${id} updated: ${transaction.status} -> ${dto.status}`,
    );

    return updated;
  }

  /**
   * Update transaction by provider reference
   */
  async updateByProviderReference(
    providerReference: string,
    dto: UpdateTransactionDto,
  ) {
    const transaction = await this.prismaService.tenancy.transaction.findUnique(
      {
        where: { providerReference },
      },
    );

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with provider reference ${providerReference} not found`,
      );
    }

    return this.update(transaction.id, dto);
  }

  /**
   * Get transaction by ID
   */
  async findOne(id: string) {
    const transaction = await this.prismaService.tenancy.transaction.findUnique(
      {
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            include: {
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
          },
          session: {
            select: {
              id: true,
              scheduledDate: true,
              consultant: {
                include: {
                  userProfile: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    );

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  /**
   * Get transaction by provider reference
   */
  async findByProviderReference(providerReference: string) {
    const transaction = await this.prismaService.tenancy.transaction.findUnique(
      {
        where: { providerReference },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          order: true,
          session: true,
        },
      },
    );

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with provider reference ${providerReference} not found`,
      );
    }

    return transaction;
  }

  /**
   * Get all transactions with filters
   */
  async findAll(
    userId?: string,
    filter?: QueryFilter<any>,
    options?: QueryOptions<any>,
  ) {
    const whereFilter: any = { ...filter };

    if (userId) {
      whereFilter.userId = userId;
    }

    const result =
      await this.prismaService.tenancy.transaction.findManyWithUrlQuery(
        whereFilter,
        options,
      );

    // Fetch with includes separately
    if (Array.isArray(result) && result.length > 0) {
      const ids = result.map((t) => t.id);
      return this.prismaService.tenancy.transaction.findMany({
        where: { id: { in: ids } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              totalAmount: true,
              currency: true,
            },
          },
          session: {
            select: {
              id: true,
              scheduledDate: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    if (!Array.isArray(result) && result.data) {
      const ids = result.data.map((t: any) => t.id);
      const data = await this.prismaService.tenancy.transaction.findMany({
        where: { id: { in: ids } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              totalAmount: true,
              currency: true,
            },
          },
          session: {
            select: {
              id: true,
              scheduledDate: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return { ...result, data };
    }

    return result;
  }

  /**
   * Get transaction statistics
   */
  async getStatistics(userId?: string) {
    const where: any = userId ? { userId } : {};

    const [total, successful, failed, pending, totalAmount, successfulAmount] =
      await Promise.all([
        this.prismaService.tenancy.transaction.count({ where }),
        this.prismaService.tenancy.transaction.count({
          where: { ...where, status: TransactionStatus.SUCCESS },
        }),
        this.prismaService.tenancy.transaction.count({
          where: { ...where, status: TransactionStatus.FAILED },
        }),
        this.prismaService.tenancy.transaction.count({
          where: { ...where, status: TransactionStatus.PENDING },
        }),
        this.prismaService.tenancy.transaction.aggregate({
          where,
          _sum: { amount: true },
        }),
        this.prismaService.tenancy.transaction.aggregate({
          where: { ...where, status: TransactionStatus.SUCCESS },
          _sum: { amount: true },
        }),
      ]);

    return {
      total,
      successful,
      failed,
      pending,
      totalAmount: totalAmount._sum.amount || 0,
      successfulAmount: successfulAmount._sum.amount || 0,
    };
  }
}
