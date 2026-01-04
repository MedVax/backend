import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreatePharmacyDto } from '../dtos/create-pharmacy.dto';
import { UpdatePharmacyDto } from '../dtos/update-pharmacy.dto';

@Injectable()
export class PharmacyService {
  private logger = new Logger(PharmacyService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  async create(userId: string, dto: CreatePharmacyDto) {
    return this.prismaService.tenancy.pharmacy.create({
      data: {
        ...dto,
        ownerUserId: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prismaService.tenancy.pharmacy.findMany({
      where: { isActive: true },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const pharmacy = await this.prismaService.tenancy.pharmacy.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        orders: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!pharmacy) {
      throw new NotFoundException(`Pharmacy with ID ${id} not found`);
    }

    return pharmacy;
  }

  async findByOwner(ownerId: string) {
    return this.prismaService.tenancy.pharmacy.findMany({
      where: { ownerUserId: ownerId },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdatePharmacyDto, userId?: string) {
    const pharmacy = await this.findOne(id);

    // If userId is provided, verify ownership
    if (userId && pharmacy.ownerUserId !== userId) {
      throw new BadRequestException(
        'You do not have permission to update this pharmacy',
      );
    }

    return this.prismaService.tenancy.pharmacy.update({
      where: { id },
      data: dto,
      include: {
        owner: {
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

  async remove(id: string) {
    await this.findOne(id);

    // Soft delete by setting isActive to false
    return this.prismaService.tenancy.pharmacy.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getOrders(id: string, status?: string) {
    await this.findOne(id);

    const where: any = { pharmacyId: id };

    if (status) {
      where.orderStatus = status;
    }

    return this.prismaService.tenancy.order.findMany({
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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
