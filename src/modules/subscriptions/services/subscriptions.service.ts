import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateSubscriptionDto } from '../dtos/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  private logger = new Logger(SubscriptionsService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  async create(userId: string, dto: CreateSubscriptionDto) {
    // Verify product exists and is active
    const product = await this.prismaService.tenancy.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }

    return this.prismaService.tenancy.subscription.create({
      data: {
        ...dto,
        userId,
        quantity: dto.quantity || 1,
        autoCharge: dto.autoCharge || false,
        isActive: true,
      },
      include: {
        product: {
          include: {
            category: true,
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
  }

  async findAll(userId?: string) {
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    return await this.prismaService.tenancy.subscription.findMany({
      where,
      include: {
        product: {
          include: {
            category: true,
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
      orderBy: {
        nextRunDate: 'asc',
      },
    });
  }

  async findOne(id: string, userId?: string) {
    const where: any = { id };

    if (userId) {
      where.userId = userId;
    }

    const subscription =
      await this.prismaService.tenancy.subscription.findFirst({
        where,
        include: {
          product: {
            include: {
              category: true,
              stock: true,
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

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    return subscription;
  }

  async pause(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prismaService.tenancy.subscription.update({
      where: { id },
      data: { isActive: false },
      include: {
        product: true,
      },
    });
  }

  async resume(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prismaService.tenancy.subscription.update({
      where: { id },
      data: { isActive: true },
      include: {
        product: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prismaService.tenancy.subscription.delete({
      where: { id },
    });
  }

  async updateNextRunDate(id: string, userId: string, nextRunDate: Date) {
    await this.findOne(id, userId);

    return this.prismaService.tenancy.subscription.update({
      where: { id },
      data: { nextRunDate },
      include: {
        product: true,
      },
    });
  }
}
