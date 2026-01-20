import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { UpdateCategoryDto } from '../dtos/update-category.dto';
import { BulkCreateCategoryDto } from '../dtos/bulk-create-category.dto';
import { RedisService } from 'services/redis.service';
import { UploadsService } from 'src/uploads/uploads.service';
import { generateCategoryImageFileName } from 'utils/file-utils';

// Cache configuration
const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = {
  CATEGORY: 'category:',
  CATEGORY_BY_ID: 'category:id:',
  CATEGORY_BY_SLUG: 'category:slug:',
  CATEGORY_LIST: 'category:list:',
  CATEGORY_HIERARCHY: 'category:hierarchy:',
  CATEGORY_PARENT: 'category:parent:',
};

@Injectable()
export class CategoriesService {
  private logger = new Logger(CategoriesService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private redisService: RedisService,
    private uploadsService: UploadsService,
  ) {}

  async create(dto: CreateCategoryDto, file?: Express.Multer.File) {
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

    try {
      let imageUrl: string | undefined;

      // Upload image if provided
      if (file) {
        // Create category first to get the ID
        const categoryResult = await this.prismaService.tenancy.category.create(
          {
            data: dto,
          },
        );

        const fileName = generateCategoryImageFileName(categoryResult, file);
        imageUrl = await this.uploadsService.initialize(file.buffer, fileName, {
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000', // 1 year cache
        });

        // Update category with image URL
        const category = await this.prismaService.tenancy.category.update({
          where: { id: categoryResult.id },
          data: { image: imageUrl },
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

        // Invalidate cache after creation
        await this.invalidateListCaches();

        return category;
      }

      // Create category without image
      const category = await this.prismaService.tenancy.category.create({
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

      // Invalidate cache after creation
      await this.invalidateListCaches();

      return category;
    } catch (error) {
      this.logger.error('Error during category creation with image:', error);
      throw new BadRequestException(
        `Failed to create category: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async bulkCreate(dto: BulkCreateCategoryDto) {
    // Check for duplicate slugs in the request
    const slugs = dto.categories.map((cat) => cat.slug);
    const duplicateSlugs = slugs.filter(
      (slug, index) => slugs.indexOf(slug) !== index,
    );
    if (duplicateSlugs.length > 0) {
      throw new BadRequestException(
        `Duplicate slugs found in request: ${duplicateSlugs.join(', ')}`,
      );
    }

    // Check if any slugs already exist in the database
    const existingCategories =
      await this.prismaService.tenancy.category.findMany({
        where: {
          slug: {
            in: slugs,
          },
        },
        select: {
          slug: true,
        },
      });

    if (existingCategories.length > 0) {
      const existingSlugs = existingCategories.map((cat) => cat.slug);
      throw new BadRequestException(
        `Categories with slugs already exist: ${existingSlugs.join(', ')}`,
      );
    }

    // Validate all parentIds exist if provided
    const parentIds = dto.categories
      .map((cat) => cat.parentId)
      .filter((id): id is string => !!id);
    const uniqueParentIds = [...new Set(parentIds)];

    if (uniqueParentIds.length > 0) {
      const existingParents =
        await this.prismaService.tenancy.category.findMany({
          where: {
            id: {
              in: uniqueParentIds,
            },
          },
          select: {
            id: true,
          },
        });

      const existingParentIds = existingParents.map((p) => p.id);
      const missingParents = uniqueParentIds.filter(
        (id) => !existingParentIds.includes(id),
      );

      if (missingParents.length > 0) {
        throw new NotFoundException(
          `Parent categories not found: ${missingParents.join(', ')}`,
        );
      }
    }

    try {
      // Create all categories in a transaction
      const categories = await this.prismaService.tenancy.$transaction(
        async (tx) => {
          const createdCategories = await Promise.all(
            dto.categories.map((categoryDto) =>
              tx.category.create({
                data: categoryDto,
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
              }),
            ),
          );

          return createdCategories;
        },
      );

      // Invalidate cache after bulk creation
      await this.invalidateListCaches();

      this.logger.log(
        `Bulk created ${categories.length} categories successfully`,
      );

      return {
        count: categories.length,
        categories,
      };
    } catch (error) {
      this.logger.error('Error during bulk category creation:', error);
      throw new BadRequestException(
        `Failed to create categories: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async findAll(includeSubcategories = false) {
    // Generate cache key
    const cacheKey = `${CACHE_PREFIX.CATEGORY_LIST}includeSubcategories:${includeSubcategories}`;

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for category list: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for category list: ${cacheKey}`);

    const where = includeSubcategories ? {} : { parentId: null };

    const categories = await this.prismaService.tenancy.category.findMany({
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

    // Cache the result
    await this.redisService.set(cacheKey, categories, CACHE_TTL);

    return categories;
  }

  async findAllWithHierarchy() {
    const cacheKey = CACHE_PREFIX.CATEGORY_HIERARCHY;

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for category hierarchy: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for category hierarchy: ${cacheKey}`);

    const categories = await this.prismaService.tenancy.category.findMany({
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

    // Cache the result
    await this.redisService.set(cacheKey, categories, CACHE_TTL);

    return categories;
  }

  async findByParent(parentId: string) {
    // Generate cache key
    const cacheKey = `${CACHE_PREFIX.CATEGORY_PARENT}${parentId}`;

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for category parent: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for category parent: ${cacheKey}`);

    const parent = await this.prismaService.tenancy.category.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException(
        `Parent category with ID ${parentId} not found`,
      );
    }

    const subcategories = await this.prismaService.tenancy.category.findMany({
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

    // Cache the result
    await this.redisService.set(cacheKey, subcategories, CACHE_TTL);

    return subcategories;
  }

  async findOne(id: string) {
    const cacheKey = `${CACHE_PREFIX.CATEGORY_BY_ID}${id}`;

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for category: ${id}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for category: ${id}`);

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

    // Cache the result
    await this.redisService.set(cacheKey, category, CACHE_TTL);

    return category;
  }

  async findBySlug(slug: string) {
    const cacheKey = `${CACHE_PREFIX.CATEGORY_BY_SLUG}${slug}`;

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for category slug: ${slug}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for category slug: ${slug}`);

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

    // Cache the result (cache by both slug and ID)
    await this.redisService.set(cacheKey, category, CACHE_TTL);
    await this.redisService.set(
      `${CACHE_PREFIX.CATEGORY_BY_ID}${category.id}`,
      category,
      CACHE_TTL,
    );

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, file?: Express.Multer.File) {
    const existing = await this.findOne(id); // Check if exists and get existing category

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
    if (dto.slug && dto.slug !== existing.slug) {
      const slugConflict = await this.prismaService.tenancy.category.findUnique(
        {
          where: { slug: dto.slug },
        },
      );

      if (slugConflict && slugConflict.id !== id) {
        throw new BadRequestException(
          `Category with slug ${dto.slug} already exists`,
        );
      }
    }

    try {
      let imageUrl: string | undefined;

      // Upload image if provided
      if (file) {
        const fileName = generateCategoryImageFileName(existing, file);
        imageUrl = await this.uploadsService.initialize(file.buffer, fileName, {
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000', // 1 year cache
        });
      }

      const categoryData: any = {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.slug ? { slug: dto.slug } : {}),
        ...(dto.parentId !== undefined
          ? dto.parentId
            ? { parent: { connect: { id: dto.parentId } } }
            : { parent: { disconnect: true } }
          : {}),
        ...(imageUrl ? { image: imageUrl } : {}),
      };

      const category = await this.prismaService.tenancy.category.update({
        where: { id },
        data: categoryData,
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

      // Invalidate cache for this category and related caches
      // If slug changed, invalidate old slug cache too
      const oldSlug =
        existing.slug !== category.slug ? existing.slug : undefined;
      await this.invalidateCategoryCache(id, oldSlug || category.slug);
      if (oldSlug && oldSlug !== category.slug) {
        await this.redisService.delete(
          `${CACHE_PREFIX.CATEGORY_BY_SLUG}${oldSlug}`,
        );
      }
      await this.invalidateListCaches();

      return category;
    } catch (error) {
      this.logger.error('Error during category update with image:', error);
      throw new BadRequestException(
        `Failed to update category: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string) {
    const category = await this.findOne(id); // Check if exists and get category with counts

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

    const deleted = await this.prismaService.tenancy.category.delete({
      where: { id },
    });

    // Invalidate cache for this category and related caches
    await this.invalidateCategoryCache(id, category.slug);
    await this.invalidateListCaches();

    return deleted;
  }

  /**
   * Cache helper methods
   */
  private async invalidateCategoryCache(id: string, slug?: string) {
    try {
      await this.redisService.delete(`${CACHE_PREFIX.CATEGORY_BY_ID}${id}`);
      if (slug) {
        await this.redisService.delete(
          `${CACHE_PREFIX.CATEGORY_BY_SLUG}${slug}`,
        );
      }
      this.logger.debug(`Invalidated cache for category: ${id}`);
    } catch (error) {
      this.logger.error(`Error invalidating category cache for ${id}:`, error);
    }
  }

  private async invalidateListCaches() {
    try {
      // Delete all list and hierarchy cache keys
      await Promise.all([
        this.redisService.deleteByPattern(`${CACHE_PREFIX.CATEGORY_LIST}*`),
        this.redisService.deleteByPattern(
          `${CACHE_PREFIX.CATEGORY_HIERARCHY}*`,
        ),
        this.redisService.deleteByPattern(`${CACHE_PREFIX.CATEGORY_PARENT}*`),
      ]);
      this.logger.debug('Invalidated category list and hierarchy caches');
    } catch (error) {
      this.logger.error('Error invalidating category list caches:', error);
    }
  }
}
