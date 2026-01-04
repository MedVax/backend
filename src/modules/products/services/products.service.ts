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
import { UploadsService } from 'src/uploads/uploads.service';
import { generateProductImageFileName } from 'utils/image-upload.util';
import { CategoriesService } from 'modules/categories/services/categories.service';
import { generateProductUploadPrefix } from 'utils/file-utils';
import { RedisService } from 'services/redis.service';
import * as crypto from 'crypto';

// Cache configuration
const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = {
  PRODUCT: 'product:',
  PRODUCT_BY_ID: 'product:id:',
  PRODUCT_BY_SKU: 'product:sku:',
  PRODUCT_LIST: 'product:list:',
  PRODUCT_SEARCH: 'product:search:',
  PRODUCT_COUNT: 'product:count:',
};

@Injectable()
export class ProductsService {
  private logger = new Logger(ProductsService.name);
  private readonly MAX_IMAGES = 10;

  constructor(
    private prismaService: PrismaTenancyService,
    private uploadsService: UploadsService,
    private categoriesService: CategoriesService,
    private redisService: RedisService,
  ) {}

  async create(dto: CreateProductDto, files?: Express.Multer.File[]) {
    const existing = await this.prismaService.tenancy.product.findUnique({
      where: { sku: dto.sku },
    });

    if (existing) {
      throw new BadRequestException(
        `Product with SKU ${dto.sku} already exists`,
      );
    }

    if (dto.categoryId) {
      const category = await this.categoriesService.findOne(dto.categoryId);
      if (!category) {
        throw new NotFoundException(
          `Category with ID ${dto.categoryId} not found`,
        );
      }
    }

    try {
      const product = await this.prismaService.corePrismaService.$transaction(
        async (trx) => {
          const productResult = await trx.product.create({
            data: {
              ...dto,
            },
          });

          if (files) {
            const filesData = files?.map((file) => ({
              file: file?.buffer,
              fileName: generateProductUploadPrefix(productResult, file),
            }));
            const attachmentsUrls =
              await this.uploadsService.initializeMany(filesData);

            const productUpdateResult = await trx.product.update({
              where: { id: productResult?.id },
              data: { images: [...attachmentsUrls] },
            });

            return productUpdateResult;
          }

          return productResult;
        },
      );

      // Invalidate cache after creation
      await this.invalidateListAndSearchCaches();

      return product;
    } catch (error) {
      this.logger.error('Error during product creation with images:', error);

      throw new BadRequestException(
        `Failed to create product: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    files?: Express.Multer.File[],
  ) {
    const existing = await this.findOneOrThrow(id);

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

    try {
      const filesData = files?.map((file) => ({
        file: file?.buffer,
        fileName: generateProductUploadPrefix(existing, file),
      }));
      const attachmentsUrls =
        await this.uploadsService.initializeMany(filesData);

      const productData = {
        ...(dto?.name ? { name: dto.name } : {}),
        ...(dto?.sku ? { sku: dto.sku } : {}),
        ...(dto?.description ? { description: dto.description } : {}),
        ...(dto?.price ? { price: dto.price } : {}),
        ...(dto?.currency ? { currency: dto.currency } : {}),
        ...(dto?.requiresPrescription
          ? { requiresPrescription: dto?.requiresPrescription }
          : {}),
        ...(dto?.productType ? { productType: dto.productType } : {}),
        ...(dto?.categoryId
          ? { category: { connect: { id: dto.categoryId } } }
          : {}),
        images: [...attachmentsUrls],
      };

      const productUpdateResult =
        await this.prismaService.tenancy.product.update({
          where: { id },
          data: productData,
        });

      // Invalidate cache for this product and related caches
      await this.invalidateProductCache(id, existing.sku);
      await this.invalidateListAndSearchCaches();

      return productUpdateResult;
    } catch (error) {
      this.logger.error('Error uploading images during product update:', error);

      throw new BadRequestException(
        `Failed to upload images: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id); // Check if exists

    let result;

    // Check if product is in any active orders
    const orderItems = await this.prismaService.tenancy.orderItem.findFirst({
      where: { productId: id },
    });

    if (orderItems) {
      // Soft delete by setting isActive to false
      result = await this.prismaService.tenancy.product.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard delete if no orders
      result = await this.prismaService.tenancy.product.delete({
        where: { id },
      });
    }

    // Invalidate cache for this product and related caches
    await this.invalidateProductCache(id, product.sku);
    await this.invalidateListAndSearchCaches();

    return result;
  }

  async findAll(
    filter?: QueryFilter<Product>,
    options?: QueryOptions<Product>,
  ) {
    // Generate cache key from filter and options
    const cacheKey = this.generateListCacheKey(filter, options);

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product list: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for product list: ${cacheKey}`);
    const result =
      await this.prismaService.tenancy.product.findManyWithUrlQuery(
        filter,
        options,
      );

    let finalResult;

    // If result is an array (not paginated), fetch with includes
    if (Array.isArray(result) && result.length > 0) {
      const ids = result.map((p) => p.id);
      finalResult = await this.prismaService.tenancy.product.findMany({
        where: { id: { in: ids } },
        include: {
          category: true,
        },
      });
    } else if (!Array.isArray(result) && result.data) {
      // If paginated, we need to fetch with includes separately
      const ids = result.data.map((p: any) => p.id);
      const data = await this.prismaService.tenancy.product.findMany({
        where: { id: { in: ids } },
        include: {
          category: true,
        },
      });
      finalResult = { ...result, data };
    } else {
      finalResult = result;
    }

    // Cache the result
    await this.redisService.set(cacheKey, finalResult, CACHE_TTL);

    return finalResult;
  }

  async count(filter?: QueryFilter<Product>, options?: QueryOptions<Product>) {
    // Generate cache key from filter and options
    const cacheKey = `${CACHE_PREFIX.PRODUCT_COUNT}${this.generateListCacheKey(filter, options)}`;

    // Check Redis cache first
    const cached = await this.redisService.get<number>(cacheKey);
    if (cached !== null && cached !== undefined) {
      this.logger.debug(`Cache hit for product count: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for product count: ${cacheKey}`);
    const count = await this.prismaService.tenancy.product.countWithUrlQuery(
      filter,
      options,
    );

    // Cache the result
    await this.redisService.set(cacheKey, { count }, CACHE_TTL);

    return count;
  }

  async findOne(id: string) {
    const cacheKey = `${CACHE_PREFIX.PRODUCT_BY_ID}${id}`;

    // Check Redis cache first
    const cached = await this.redisService.get<Product>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product: ${id}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for product: ${id}`);
    const product = await this.prismaService.tenancy.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Cache the result
    await this.redisService.set(cacheKey, product, CACHE_TTL);

    return product;
  }

  async findOneOrThrow(id: string) {
    const product = await this.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async findBySku(sku: string) {
    const cacheKey = `${CACHE_PREFIX.PRODUCT_BY_SKU}${sku}`;

    // Check Redis cache first
    const cached = await this.redisService.get<Product>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product SKU: ${sku}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for product SKU: ${sku}`);
    const product = await this.prismaService.tenancy.product.findUnique({
      where: { sku },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with SKU ${sku} not found`);
    }

    // Cache the result (cache by both SKU and ID)
    await this.redisService.set(cacheKey, product, CACHE_TTL);
    await this.redisService.set(
      `${CACHE_PREFIX.PRODUCT_BY_ID}${product.id}`,
      product,
      CACHE_TTL,
    );

    return product;
  }

  async searchProducts(searchTerm: string, filters?: any) {
    // Generate cache key from search term and filters
    const cacheKey = this.generateSearchCacheKey(searchTerm, filters);

    // Check Redis cache first
    const cached = await this.redisService.get<Product[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product search: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for product search: ${cacheKey}`);
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

    const products = await this.prismaService.tenancy.product.findMany({
      where,
      include: {
        category: true,
      },
    });

    // Cache the result
    await this.redisService.set(cacheKey, products, CACHE_TTL);

    return products;
  }

  async uploadImages(productId: string, files: Express.Multer.File[]) {
    // Verify product exists
    const product = await this.findOne(productId);

    if (!files || files.length === 0) {
      throw new BadRequestException('No images provided');
    }

    // Limit to 10 images total
    const maxImages = 10;
    const currentImages = product.images || [];
    const totalImages = currentImages.length + files.length;

    if (totalImages > maxImages) {
      throw new BadRequestException(
        `Maximum ${maxImages} images allowed per product. Current: ${currentImages.length}, attempting to add: ${files.length}`,
      );
    }

    try {
      // Upload all images to DigitalOcean Spaces
      const uploadPromises = files.map((file, index) => {
        const fileName = generateProductImageFileName(
          productId,
          file.originalname,
          currentImages.length + index,
        );

        return this.uploadsService.initialize(file.buffer, fileName, {
          ContentType: file.mimetype,
          CacheControl: 'max-age=31536000', // 1 year cache
        });
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      // Update product with new image URLs
      const updatedImages = [...currentImages, ...uploadedUrls];

      const updatedProduct = await this.prismaService.tenancy.product.update({
        where: { id: productId },
        data: {
          images: updatedImages,
        },
        include: {
          category: true,
        },
      });

      this.logger.log(
        `Uploaded ${uploadedUrls.length} images for product ${productId}`,
      );

      // Invalidate cache for this product
      await this.invalidateProductCache(productId, product.sku);

      return {
        product: updatedProduct,
        uploadedImages: uploadedUrls,
        totalImages: updatedImages.length,
      };
    } catch (error) {
      this.logger.error(
        `Error uploading images for product ${productId}:`,
        error,
      );
      throw new BadRequestException(
        `Failed to upload images: ${error.message}`,
      );
    }
  }

  async deleteImage(productId: string, imageUrl: string) {
    // Verify product exists
    const product = await this.findOne(productId);

    if (!product.images || !product.images.includes(imageUrl)) {
      throw new NotFoundException('Image not found for this product');
    }

    try {
      // Extract the key from the URL
      let key: string;
      try {
        const urlObj = new URL(imageUrl);
        key = urlObj.pathname.startsWith('/')
          ? urlObj.pathname.substring(1)
          : urlObj.pathname;
      } catch {
        // If imageUrl is already a key/path, use it directly
        key = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
      }

      // Delete from DigitalOcean Spaces
      await this.uploadsService.delete(key);

      // Remove from product images array
      const updatedImages = product.images.filter((img) => img !== imageUrl);

      const updatedProduct = await this.prismaService.tenancy.product.update({
        where: { id: productId },
        data: {
          images: updatedImages,
        },
        include: {
          category: true,
        },
      });

      this.logger.log(`Deleted image ${imageUrl} for product ${productId}`);

      // Invalidate cache for this product
      await this.invalidateProductCache(productId, product.sku);

      return {
        product: updatedProduct,
        deletedImage: imageUrl,
        remainingImages: updatedImages.length,
      };
    } catch (error) {
      this.logger.error(
        `Error deleting image for product ${productId}:`,
        error,
      );
      throw new BadRequestException(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Cache helper methods
   */
  private generateListCacheKey(
    filter?: QueryFilter<Product>,
    options?: QueryOptions<Product>,
  ): string {
    const hashInput = JSON.stringify({ filter, options });
    const hash = crypto.createHash('md5').update(hashInput).digest('hex');
    return `${CACHE_PREFIX.PRODUCT_LIST}${hash}`;
  }

  private generateSearchCacheKey(searchTerm: string, filters?: any): string {
    const hashInput = JSON.stringify({ searchTerm, filters });
    const hash = crypto.createHash('md5').update(hashInput).digest('hex');
    return `${CACHE_PREFIX.PRODUCT_SEARCH}${hash}`;
  }

  private async invalidateProductCache(productId: string, sku?: string) {
    try {
      await this.redisService.delete(
        `${CACHE_PREFIX.PRODUCT_BY_ID}${productId}`,
      );
      if (sku) {
        await this.redisService.delete(`${CACHE_PREFIX.PRODUCT_BY_SKU}${sku}`);
      }
      this.logger.debug(`Invalidated cache for product: ${productId}`);
    } catch (error) {
      this.logger.error(
        `Error invalidating product cache for ${productId}:`,
        error,
      );
    }
  }

  private async invalidateListAndSearchCaches() {
    try {
      // Delete all list and search cache keys
      await Promise.all([
        this.redisService.deleteByPattern(`${CACHE_PREFIX.PRODUCT_LIST}*`),
        this.redisService.deleteByPattern(`${CACHE_PREFIX.PRODUCT_SEARCH}*`),
        this.redisService.deleteByPattern(`${CACHE_PREFIX.PRODUCT_COUNT}*`),
      ]);
      this.logger.debug('Invalidated list and search caches');
    } catch (error) {
      this.logger.error('Error invalidating list/search caches:', error);
    }
  }
}
