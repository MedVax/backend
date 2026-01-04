import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateAddressDto } from '../dtos/create-address.dto';
import { UpdateAddressDto } from '../dtos/update-address.dto';

@Injectable()
export class AddressesService {
  private logger = new Logger(AddressesService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  async create(userId: string, dto: CreateAddressDto) {
    // If this is set as default, unset other defaults
    if (dto.isDefault) {
      await this.prismaService.tenancy.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prismaService.tenancy.address.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return await this.prismaService.tenancy.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, userId: string) {
    const address = await this.prismaService.tenancy.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }

    return address;
  }

  async update(id: string, userId: string, dto: UpdateAddressDto) {
    await this.findOne(id, userId); // Check if exists and belongs to user

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prismaService.tenancy.address.updateMany({
        where: { userId, id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prismaService.tenancy.address.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    // Check if address is used in any orders
    const orders = await this.prismaService.tenancy.order.findFirst({
      where: { deliveryAddressId: id },
    });

    if (orders) {
      throw new BadRequestException(
        'Cannot delete address that is associated with orders',
      );
    }

    return this.prismaService.tenancy.address.delete({
      where: { id },
    });
  }

  async setDefault(id: string, userId: string) {
    await this.findOne(id, userId);

    // Unset all other defaults
    await this.prismaService.tenancy.address.updateMany({
      where: { userId, id: { not: id }, isDefault: true },
      data: { isDefault: false },
    });

    return this.prismaService.tenancy.address.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async getDefault(userId: string) {
    return await this.prismaService.tenancy.address.findFirst({
      where: { userId, isDefault: true },
    });
  }
}
