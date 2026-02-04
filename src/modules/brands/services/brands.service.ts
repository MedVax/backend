import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CreateBrandDto } from '../dtos/create-brand.dto';
import { UpdateBrandDto } from '../dtos/update-brand.dto';
import { RedisService } from 'services/redis.service';
import { UploadsService } from 'src/uploads/uploads.service';
import { generateBrandLogoFileName } from 'utils/file-utils';

// Cache configuration
const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = {
  BRAND: 'brand:',
  BRAND_BY_ID: 'brand:id:',
  BRAND_LIST: 'brand:list:',
};

@Injectable()
export class BrandsService {
  private logger = new Logger(BrandsService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private redisService: RedisService,
    private uploadsService: UploadsService,
  ) {}

  async create(dto: CreateBrandDto, file?: Express.Multer.File) {
    // Check if brand name already exists
    const existing = await this.prismaService.tenancy.brand.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException(
        `Brand with name ${dto.name} already exists`,
      );
    }

    try {
      let logoUrl: string | undefined;

      // Upload logo if provided
      if (file) {
        // Create brand first to get the ID
        const brandResult = await this.prismaService.tenancy.brand.create({
          data: {
            name: dto.name,
            description: dto.description,
            website: dto.website,
            isActive: dto.isActive ?? true,
          },
        });

        const fileName = generateBrandLogoFileName(brandResult, file);
        logoUrl = await this.uploadsService.initialize(
          file.buffer,
          fileName,
          {
            ContentType: file.mimetype,
            CacheControl: 'max-age=31536000', // 1 year cache
          },
          true, // Optimize image
        );

        // Update brand with logo URL
        const brand = await this.prismaService.tenancy.brand.update({
          where: { id: brandResult.id },
          data: { logo: logoUrl },
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        });

        // Invalidate cache
        await this.invalidateListCaches();

        this.logger.log(`Brand created successfully: ${brand.id}`);
        return brand;
      }

      // Create brand without logo
      const brand = await this.prismaService.tenancy.brand.create({
        data: {
          name: dto.name,
          description: dto.description,
          website: dto.website,
          isActive: dto.isActive ?? true,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      // Invalidate cache
      await this.invalidateListCaches();

      this.logger.log(`Brand created successfully: ${brand.id}`);
      return brand;
    } catch (error) {
      this.logger.error('Error creating brand:', error);
      throw new BadRequestException(
        `Failed to create brand: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async findAll(includeInactive = false) {
    // Generate cache key
    const cacheKey = `${CACHE_PREFIX.BRAND_LIST}includeInactive:${includeInactive}`;

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for brand list: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for brand list: ${cacheKey}`);

    const where = includeInactive ? {} : { isActive: true };

    const brands = await this.prismaService.tenancy.brand.findMany({
      where,
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
    await this.redisService.set(cacheKey, brands, CACHE_TTL);

    return brands;
  }

  async findOne(id: string) {
    const cacheKey = `${CACHE_PREFIX.BRAND_BY_ID}${id}`;

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for brand: ${id}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for brand: ${id}`);
    const brand = await this.prismaService.tenancy.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    // Cache the result
    await this.redisService.set(cacheKey, brand, CACHE_TTL);

    return brand;
  }

  async update(id: string, dto: UpdateBrandDto, file?: Express.Multer.File) {
    // Check if brand exists
    const existing = await this.prismaService.tenancy.brand.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    // Check if name is being updated and if it conflicts with another brand
    if (dto.name && dto.name !== existing.name) {
      const nameConflict = await this.prismaService.tenancy.brand.findFirst({
        where: { name: dto.name },
      });

      if (nameConflict) {
        throw new BadRequestException(
          `Brand with name ${dto.name} already exists`,
        );
      }
    }

    try {
      let logoUrl: string | undefined;

      // Upload logo if provided
      if (file) {
        const fileName = generateBrandLogoFileName(existing, file);
        logoUrl = await this.uploadsService.initialize(
          file.buffer,
          fileName,
          {
            ContentType: file.mimetype,
            CacheControl: 'max-age=31536000', // 1 year cache
          },
          true, // Optimize image
        );
      }

      // Update brand
      const updateData: any = {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(logoUrl && { logo: logoUrl }),
      };

      const brand = await this.prismaService.tenancy.brand.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      // Invalidate cache
      await this.invalidateBrandCache(id);
      await this.invalidateListCaches();

      this.logger.log(`Brand updated successfully: ${id}`);
      return brand;
    } catch (error) {
      this.logger.error('Error updating brand:', error);
      throw new BadRequestException(
        `Failed to update brand: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string) {
    // Check if brand exists
    const brand = await this.prismaService.tenancy.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    // Check if brand has products
    if (brand._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete brand with ID ${id} because it has ${brand._count.products} associated product(s). Please remove or reassign products first.`,
      );
    }

    try {
      await this.prismaService.tenancy.brand.delete({
        where: { id },
      });

      // Invalidate cache
      await this.invalidateBrandCache(id);
      await this.invalidateListCaches();

      this.logger.log(`Brand deleted successfully: ${id}`);
      return { message: 'Brand deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting brand:', error);
      throw new BadRequestException(
        `Failed to delete brand: ${error.message || 'Unknown error'}`,
      );
    }
  }

  // Private helper methods for cache invalidation
  private async invalidateBrandCache(id: string) {
    const cacheKey = `${CACHE_PREFIX.BRAND_BY_ID}${id}`;
    await this.redisService.delete(cacheKey);
  }

  private async invalidateListCaches() {
    const keys = [
      `${CACHE_PREFIX.BRAND_LIST}includeInactive:true`,
      `${CACHE_PREFIX.BRAND_LIST}includeInactive:false`,
    ];
    await Promise.all(keys.map((key) => this.redisService.delete(key)));
  }
}
