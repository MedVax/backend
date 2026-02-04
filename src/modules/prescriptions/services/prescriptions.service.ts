import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreatePrescriptionDto } from '../dtos/create-prescription.dto';
import { VerifyPrescriptionDto } from '../dtos/verify-prescription.dto';
import { PrescriptionStatus, type Prisma } from 'generated/prisma/client';
import { randomUUID } from 'crypto';
import { UploadsService } from 'src/uploads/uploads.service';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { GetPrescriptionsFilterQuery } from '../dtos/get-prescriptions-filter-query.dto';
import { isArray } from 'class-validator';

@Injectable()
export class PrescriptionsService {
  private logger = new Logger(PrescriptionsService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private uploadsService: UploadsService,
  ) {}

  async create(
    dto: CreatePrescriptionDto,
    file?: Express.Multer.File,
    userId?: string,
  ) {
    // If orderId is provided, verify it belongs to user
    if (dto.orderId) {
      const order = await this.prismaService.tenancy.order.findFirst({
        where: { id: dto.orderId, userId },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }
    }

    // Upload file if provided
    let fileUrl = dto.fileUrl;
    if (file) {
      const fileName = `prescriptions/${userId}/${randomUUID()}-${file.originalname}`;
      fileUrl = await this.uploadsService.initialize(
        file.buffer,
        fileName,
        {
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000', // 1 year cache
        },
        true, // Optimize image if it's an image
      );
    }

    if (!fileUrl) {
      throw new BadRequestException('File URL or file upload is required');
    }

    return this.prismaService.tenancy.prescription.create({
      data: {
        ...dto,
        fileUrl,
        ...(userId ? { userId } : {}),
        uploadedBy: userId,
        status: PrescriptionStatus.PENDING,
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
    paginationQueryParams: PaginationQuery,
    filterQueryParams: GetPrescriptionsFilterQuery,
    userId?: string,
  ) {
    const {
      search,
      status,
      prescriberType,
      userId: filterUserId,
    } = filterQueryParams;

    // Use userId from filter if provided (for consultants/admins), otherwise use authenticated user's id
    const finalUserId = filterUserId || userId;

    const where: Prisma.PrescriptionWhereInput = {
      AND: [
        finalUserId ? { userId: finalUserId } : {},
        search
          ? {
              OR: [
                { patientName: { contains: search, mode: 'insensitive' } },
                { prescriberName: { contains: search, mode: 'insensitive' } },
                { drugName: { contains: search, mode: 'insensitive' } },
                { hospitalName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        status
          ? isArray(status)
            ? { status: { in: status } }
            : { status }
          : {},
        prescriberType ? { prescriberType } : {},
      ],
    };

    return this.prismaService.tenancy.prescription.paginate({
      where,
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
      orderBy: { createdAt: 'desc' },
      ...paginationQueryParams,
    });
  }

  async count(filterQueryParams: GetPrescriptionsFilterQuery, userId?: string) {
    const {
      search,
      status,
      prescriberType,
      userId: filterUserId,
    } = filterQueryParams;

    // Use userId from filter if provided (for consultants/admins), otherwise use authenticated user's id
    const finalUserId = filterUserId || userId;

    const where: Prisma.PrescriptionWhereInput = {
      AND: [
        finalUserId ? { userId: finalUserId } : {},
        search
          ? {
              OR: [
                { patientName: { contains: search, mode: 'insensitive' } },
                { prescriberName: { contains: search, mode: 'insensitive' } },
                { drugName: { contains: search, mode: 'insensitive' } },
                { hospitalName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        status
          ? isArray(status)
            ? { status: { in: status } }
            : { status }
          : {},
        prescriberType ? { prescriberType } : {},
      ],
    };

    return this.prismaService.tenancy.prescription.count({ where });
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
