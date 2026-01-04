import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { QueryFilter, QueryOptions } from 'libs/url-to-db-query';
import type { Product } from 'generated/prisma/client';

@Injectable()
export class ProductsService {
  private logger = new Logger(ProductsService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  async create(dto: CreateProductDto) {
    const { stock, ...productData } = dto;

    // Check if SKU already exists
    const existing = await this.prismaService.tenancy.product.findUnique({
      where: { sku: dto.sku },
    });

    if (existing) {
      throw new BadRequestException(
        `Product with SKU ${dto.sku} already exists`,
      );
    }

    // Create product with stock in a transaction
    const product = await this.prismaService.tenancy.$transaction(
      async (tx) => {
        const created = await tx.product.create({
          data: productData,
          include: {
            category: true,
            stock: {
              include: {
                pharmacy: true,
              },
            },
          },
        });

        // Create stock entries if provided
        if (stock && stock.length > 0) {
          await Promise.all(
            stock.map((s) =>
              tx.productStock.upsert({
                where: {
                  productId_pharmacyId: {
                    productId: created.id,
                    pharmacyId: s.pharmacyId,
                  },
                },
                create: {
                  productId: created.id,
                  pharmacyId: s.pharmacyId,
                  quantity: s.quantity,
                },
                update: {
                  quantity: s.quantity,
                },
              }),
            ),
          );
        }

        return tx.product.findUnique({
          where: { id: created.id },
          include: {
            category: true,
            stock: {
              include: {
                pharmacy: true,
              },
            },
          },
        });
      },
    );

    return product;
  }

  async findAll(
    filter?: QueryFilter<Product>,
    options?: QueryOptions<Product>,
  ) {
    const result =
      await this.prismaService.tenancy.product.findManyWithUrlQuery(
        filter,
        options,
      );

    // If result is an array (not paginated), fetch with includes
    if (Array.isArray(result) && result.length > 0) {
      const ids = result.map((p) => p.id);
      return this.prismaService.tenancy.product.findMany({
        where: { id: { in: ids } },
        include: {
          category: true,
          stock: {
            include: {
              pharmacy: true,
            },
          },
        },
      });
    }

    // If paginated, we need to fetch with includes separately
    if (!Array.isArray(result) && result.data) {
      const ids = result.data.map((p: any) => p.id);
      const data = await this.prismaService.tenancy.product.findMany({
        where: { id: { in: ids } },
        include: {
          category: true,
          stock: {
            include: {
              pharmacy: true,
            },
          },
        },
      });
      return { ...result, data };
    }

    return result;
  }

  async count(filter?: QueryFilter<Product>, options?: QueryOptions<Product>) {
    return await this.prismaService.tenancy.product.countWithUrlQuery(
      filter,
      options,
    );
  }

  async findOne(id: string) {
    const product = await this.prismaService.tenancy.product.findUnique({
      where: { id },
      include: {
        category: true,
        stock: {
          include: {
            pharmacy: {
              select: {
                id: true,
                name: true,
                address: true,
                phone: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async findBySku(sku: string) {
    const product = await this.prismaService.tenancy.product.findUnique({
      where: { sku },
      include: {
        category: true,
        stock: {
          include: {
            pharmacy: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with SKU ${sku} not found`);
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const { stock, ...productData } = dto;

    // Check if product exists
    const existing = await this.findOne(id);

    // If SKU is being updated, check for conflicts
    if (dto.sku && dto.sku !== existing.sku) {
      const skuConflict = await this.prismaService.tenancy.product.findUnique({
        where: { sku: dto.sku },
      });

      if (skuConflict) {
        throw new BadRequestException(
          `Product with SKU ${dto.sku} already exists`,
        );
      }
    }

    const product = await this.prismaService.tenancy.$transaction(
      async (tx) => {
        await tx.product.update({
          where: { id },
          data: productData,
        });

        // Update stock entries if provided
        if (stock && stock.length > 0) {
          await Promise.all(
            stock.map((s) =>
              tx.productStock.upsert({
                where: {
                  productId_pharmacyId: {
                    productId: id,
                    pharmacyId: s.pharmacyId,
                  },
                },
                create: {
                  productId: id,
                  pharmacyId: s.pharmacyId,
                  quantity: s.quantity,
                },
                update: {
                  quantity: s.quantity,
                },
              }),
            ),
          );
        }

        return tx.product.findUnique({
          where: { id },
          include: {
            category: true,
            stock: {
              include: {
                pharmacy: true,
              },
            },
          },
        });
      },
    );

    return product;
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists

    // Check if product is in any active orders
    const orderItems = await this.prismaService.tenancy.orderItem.findFirst({
      where: { productId: id },
    });

    if (orderItems) {
      // Soft delete by setting isActive to false
      return this.prismaService.tenancy.product.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Hard delete if no orders
    return this.prismaService.tenancy.product.delete({
      where: { id },
    });
  }

  async updateStock(productId: string, pharmacyId: string, quantity: number) {
    await this.findOne(productId);

    return this.prismaService.tenancy.productStock.upsert({
      where: {
        productId_pharmacyId: {
          productId,
          pharmacyId,
        },
      },
      create: {
        productId,
        pharmacyId,
        quantity,
      },
      update: {
        quantity,
      },
      include: {
        product: true,
        pharmacy: true,
      },
    });
  }

  async searchProducts(searchTerm: string, filters?: any) {
    const where: any = {
      isActive: true,
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.requiresPrescription !== undefined) {
      where.requiresPrescription = filters.requiresPrescription;
    }

    if (filters?.productType) {
      where.productType = filters.productType;
    }

    return await this.prismaService.tenancy.product.findMany({
      where,
      include: {
        category: true,
        stock: {
          include: {
            pharmacy: true,
          },
        },
      },
    });
  }
}
