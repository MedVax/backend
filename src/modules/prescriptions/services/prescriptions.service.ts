import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreatePrescriptionDto } from '../dtos/create-prescription.dto';
import { VerifyPrescriptionDto } from '../dtos/verify-prescription.dto';
import { QueryFilter, QueryOptions } from 'libs/url-to-db-query';
import type { Prescription } from 'generated/prisma/client';

@Injectable()
export class PrescriptionsService {
  private logger = new Logger(PrescriptionsService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  async create(userId: string, dto: CreatePrescriptionDto) {
    // If orderId is provided, verify it belongs to user
    if (dto.orderId) {
      const order = await this.prismaService.tenancy.order.findFirst({
        where: { id: dto.orderId, userId },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }
    }

    return this.prismaService.tenancy.prescription.create({
      data: {
        ...dto,
        userId,
        uploadedBy: userId,
        status: 'PENDING',
      },
      include: {
        order: true,
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

  async findAll(
    userId?: string,
    filter?: QueryFilter<Prescription>,
    options?: QueryOptions<Prescription>,
  ) {
    const whereFilter: any = { ...filter };

    if (userId) {
      whereFilter.userId = userId;
    }

    const result =
      await this.prismaService.tenancy.prescription.findManyWithUrlQuery(
        whereFilter,
        options,
      );

    // Fetch with includes separately
    if (Array.isArray(result) && result.length > 0) {
      const ids = result.map((p) => p.id);
      return this.prismaService.tenancy.prescription.findMany({
        where: { id: { in: ids } },
        include: {
          order: {
            include: {
              items: true,
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
          createdAt: 'desc',
        },
      });
    }

    if (!Array.isArray(result) && result.data) {
      const ids = result.data.map((p: any) => p.id);
      const data = await this.prismaService.tenancy.prescription.findMany({
        where: { id: { in: ids } },
        include: {
          order: {
            include: {
              items: true,
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
          createdAt: 'desc',
        },
      });
      return { ...result, data };
    }

    return result;
  }

  async count(
    userId?: string,
    filter?: QueryFilter<Prescription>,
    options?: QueryOptions<Prescription>,
  ) {
    const whereFilter: any = { ...filter };

    if (userId) {
      whereFilter.userId = userId;
    }

    return this.prismaService.tenancy.prescription.countWithUrlQuery(
      whereFilter,
      options,
    );
  }

  async findOne(id: string, userId?: string) {
    const where: any = { id };

    if (userId) {
      where.userId = userId;
    }

    const prescription =
      await this.prismaService.tenancy.prescription.findFirst({
        where,
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
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

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    return prescription;
  }

  async verify(id: string, dto: VerifyPrescriptionDto, reviewerId: string) {
    const prescription =
      await this.prismaService.tenancy.prescription.findUnique({
        where: { id },
      });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID ${id} not found`);
    }

    if (prescription.status !== 'PENDING') {
      throw new BadRequestException('Prescription has already been reviewed');
    }

    const updated = await this.prismaService.tenancy.prescription.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedBy: reviewerId,
        notes: dto.notes,
      },
      include: {
        order: true,
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

    // If prescription is approved and has an order, update order prescription status
    if (dto.status === 'APPROVED' && prescription.orderId) {
      await this.prismaService.tenancy.order.update({
        where: { id: prescription.orderId },
        data: {
          prescriptionStatus: 'APPROVED',
        },
      });
    } else if (dto.status === 'REJECTED' && prescription.orderId) {
      await this.prismaService.tenancy.order.update({
        where: { id: prescription.orderId },
        data: {
          prescriptionStatus: 'REJECTED',
        },
      });
    }

    return updated;
  }

  async remove(id: string, userId: string) {
    const prescription = await this.findOne(id, userId);

    if (prescription.status !== 'PENDING') {
      throw new BadRequestException('Cannot delete reviewed prescription');
    }

    return this.prismaService.tenancy.prescription.delete({
      where: { id },
    });
  }
}
