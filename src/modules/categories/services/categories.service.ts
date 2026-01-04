import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { UpdateCategoryDto } from '../dtos/update-category.dto';

@Injectable()
export class CategoriesService {
  private logger = new Logger(CategoriesService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  async create(dto: CreateCategoryDto) {
    // Check if slug already exists
    const existing = await this.prismaService.tenancy.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException(
        `Category with slug ${dto.slug} already exists`,
      );
    }

    // If parentId is provided, verify it exists
    if (dto.parentId) {
      const parent = await this.prismaService.tenancy.category.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID ${dto.parentId} not found`,
        );
      }
    }

    return await this.prismaService.tenancy.category.create({
      data: dto,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  }

  async findAll(includeSubcategories = false) {
    const where = includeSubcategories ? {} : { parentId: null };

    return await this.prismaService.tenancy.category.findMany({
      where,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findAllWithHierarchy() {
    return await this.prismaService.tenancy.category.findMany({
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async findByParent(parentId: string) {
    const parent = await this.prismaService.tenancy.category.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException(
        `Parent category with ID ${parentId} not found`,
      );
    }

    return this.prismaService.tenancy.category.findMany({
      where: { parentId },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const category = await this.prismaService.tenancy.category.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        products: {
          where: {
            isActive: true,
          },
          take: 10,
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.prismaService.tenancy.category.findUnique({
      where: { slug },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        products: {
          where: {
            isActive: true,
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id); // Check if exists

    // Prevent circular reference - can't set parent to self or any descendant
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      // Check if the new parent is a descendant
      const checkCircular = async (
        categoryId: string,
        targetParentId: string,
      ): Promise<boolean> => {
        const current = await this.prismaService.tenancy.category.findUnique({
          where: { id: categoryId },
          select: { parentId: true },
        });

        if (!current || !current.parentId) return false;
        if (current.parentId === targetParentId) return true;

        return checkCircular(current.parentId, targetParentId);
      };

      if (await checkCircular(dto.parentId, id)) {
        throw new BadRequestException(
          'Cannot set parent: would create circular reference',
        );
      }

      // Verify parent exists
      const parent = await this.prismaService.tenancy.category.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID ${dto.parentId} not found`,
        );
      }
    }

    // If slug is being updated, check for conflicts
    if (dto.slug) {
      const existing = await this.prismaService.tenancy.category.findUnique({
        where: { slug: dto.slug },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException(
          `Category with slug ${dto.slug} already exists`,
        );
      }
    }

    return await this.prismaService.tenancy.category.update({
      where: { id },
      data: dto,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const category = await this.findOne(id); // Check if exists

    // Check if category has products
    if (category._count.products > 0) {
      throw new BadRequestException(
        'Cannot delete category with existing products',
      );
    }

    // Check if category has subcategories
    if (category._count.children > 0) {
      throw new BadRequestException(
        'Cannot delete category with existing subcategories. Please delete or move subcategories first.',
      );
    }

    return this.prismaService.tenancy.category.delete({
      where: { id },
    });
  }
}
