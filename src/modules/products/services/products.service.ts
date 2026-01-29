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
import type { Product, Prisma } from 'generated/prisma/client';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { GetProductsFilterQuery } from '../dtos/get-products-filter-query.dto';
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
  PRODUCT_BEST_SELLING: 'product:best-selling:',
  PRODUCT_RELATED: 'product:related:',
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

    if (dto.brandId) {
      const brand = await this.prismaService.tenancy.brand.findUnique({
        where: { id: dto.brandId },
      });
      if (!brand) {
        throw new NotFoundException(`Brand with ID ${dto.brandId} not found`);
      }
    }

    try {
      const product = await this.prismaService.corePrismaService.$transaction(
        async (trx) => {
          const productResult = await trx.product.create({
            data: {
              name: dto.name,
              sku: dto.sku,
              description: dto.description,
              price: dto.price,
              currency: dto.currency,
              requiresPrescription: dto.requiresPrescription,
              productType: dto.productType,
              categoryId: dto.categoryId,
              brandId: dto.brandId,
              dosages: dto.dosages,
              packageSizes: dto.packageSizes,
              howToUse: dto.howToUse,
              ingredients: dto.ingredients,
              pharmacyAdvise: dto.pharmacyAdvise,
              specification: dto.specification,
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

  async update(dto: UpdateProductDto, files?: Express.Multer.File[]) {
    const existing = await this.findOneOrThrow(dto.id);

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
        ...(dto?.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto?.price ? { price: dto.price } : {}),
        ...(dto?.currency ? { currency: dto.currency } : {}),
        ...(dto?.requiresPrescription
          ? { requiresPrescription: dto?.requiresPrescription }
          : {}),
        ...(dto?.productType ? { productType: dto.productType } : {}),
        ...(dto?.categoryId
          ? { category: { connect: { id: dto.categoryId } } }
          : {}),
        ...(dto?.brandId ? { brand: { connect: { id: dto.brandId } } } : {}),
        ...(dto?.dosages !== undefined ? { dosages: dto.dosages } : {}),
        ...(dto?.packageSizes !== undefined
          ? { packageSizes: dto.packageSizes }
          : {}),
        ...(dto?.howToUse !== undefined ? { howToUse: dto.howToUse } : {}),
        ...(dto?.ingredients !== undefined
          ? { ingredients: dto.ingredients }
          : {}),
        ...(dto?.pharmacyAdvise !== undefined
          ? { pharmacyAdvise: dto.pharmacyAdvise }
          : {}),
        ...(dto?.specification !== undefined
          ? { specification: dto.specification }
          : {}),
        images: [...attachmentsUrls],
      };

      const productUpdateResult =
        await this.prismaService.tenancy.product.update({
          where: { id: dto.id },
          data: productData,
        });

      // Invalidate cache for this product and related caches
      await this.invalidateProductCache(dto.id, existing.sku);
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
    paginationQueryParams: PaginationQuery,
    filterQueryParams: GetProductsFilterQuery,
  ) {
    const {
      search,
      brandId,
      categoryId,
      productType,
      requiresPrescription,
      isActive,
      availability,
    } = filterQueryParams;

    const categoryIds = categoryId?.split(',');
    const brandIds = brandId?.split(',');

    // Handle category with subcategories
    let categoryFilter: Prisma.ProductWhereInput | undefined;
    if (categoryIds) {
      categoryFilter = { categoryId: { in: categoryIds } };
    }

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        brandIds?.length > 0 ? { brandId: { in: brandIds } } : {},
        categoryIds?.length > 0 ? categoryFilter : {},
        productType ? { productType } : {},
        requiresPrescription !== undefined ? { requiresPrescription } : {},
        isActive !== undefined ? { isActive } : { isActive: true }, // Default to active products
        availability === 'in stock' ? { stockQuantity: { gt: 0 } } : {},
        availability === 'out of stock' ? { stockQuantity: { equals: 0 } } : {},
      ],
    };

    // Generate cache key from pagination and filter params
    const cacheKey = this.generateListCacheKeyFromParams(
      paginationQueryParams,
      filterQueryParams,
    );

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product list: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for product list: ${cacheKey}`);
    const result = await this.prismaService.tenancy.product.paginate({
      where,
      include: {
        category: true,
        brand: true,
      },
      orderBy: { createdAt: 'desc' },
      ...paginationQueryParams,
    });

    // Cache the result
    await this.redisService.set(cacheKey, result, CACHE_TTL);

    return result;
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
        brand: true,
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
        brand: true,
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
        brand: true,
      },
    });

    // Cache the result
    await this.redisService.set(cacheKey, products, CACHE_TTL);

    return products;
  }

  async getBestSelling(limit: number = 10) {
    const cacheKey = `${CACHE_PREFIX.PRODUCT_BEST_SELLING}limit:${limit}`;

    // Check Redis cache first
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for best selling products: ${cacheKey}`);
      return cached;
    }

    // Cache miss - fetch from database
    this.logger.debug(`Cache miss for best selling products: ${cacheKey}`);

    // Get best selling products based on order items quantity
    // Only count items from completed/paid orders
    const bestSellingProducts = await this.prismaService.tenancy.$queryRaw<
      Array<{
        productId: string;
        totalQuantity: bigint;
      }>
    >`
      SELECT 
        oi."productId",
        SUM(oi.quantity) as "totalQuantity"
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON oi."orderId" = o.id
      WHERE o."paymentStatus" = 'PAID'
        AND o."orderStatus" IN ('DELIVERED', 'COMPLETED')
        AND oi."productId" IS NOT NULL
      GROUP BY oi."productId"
      ORDER BY "totalQuantity" DESC
      LIMIT ${limit}
    `;

    if (!bestSellingProducts || bestSellingProducts.length === 0) {
      // If no best selling products, return active products ordered by creation date
      const fallbackProducts =
        await this.prismaService.tenancy.product.findMany({
          where: {
            isActive: true,
          },
          include: {
            category: true,
            brand: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: limit,
        });

      await this.redisService.set(cacheKey, fallbackProducts, CACHE_TTL);
      return fallbackProducts;
    }

    const productIds = bestSellingProducts.map((p) => p.productId);

    // Fetch full product details
    const products = await this.prismaService.tenancy.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
      include: {
        category: true,
        brand: true,
      },
    });

    // Sort products by the order from bestSellingProducts
    const sortedProducts = productIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    // Cache the result
    await this.redisService.set(cacheKey, sortedProducts, CACHE_TTL);

    return sortedProducts;
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
  private generateListCacheKeyFromParams(
    paginationQueryParams: PaginationQuery,
    filterQueryParams: GetProductsFilterQuery,
  ): string {
    const hashInput = JSON.stringify({
      paginationQueryParams,
      filterQueryParams,
    });
    const hash = crypto.createHash('md5').update(hashInput).digest('hex');
    return `${CACHE_PREFIX.PRODUCT_LIST}${hash}`;
  }

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

  /**
   * Get related products for a given product
   * Returns products from the same category or brand, excluding the current product
   */
  async getRelatedProducts(productId: string, limit: number = 10) {
    const cacheKey = `${CACHE_PREFIX.PRODUCT_RELATED}${productId}:limit:${limit}`;

    // Check Redis cache first
    const cached = await this.redisService.get<Product[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for related products: ${cacheKey}`);
      return cached;
    }

    // Get the current product to find related ones
    const product = await this.findOne(productId);

    // Build where clause to find related products
    const whereConditions: Prisma.ProductWhereInput[] = [
      { id: { not: productId } }, // Exclude current product
      { isActive: true }, // Only active products
    ];

    // Add category filter if product has a category
    if (product.categoryId) {
      whereConditions.push({ categoryId: product.categoryId });
    }

    // Add brand filter if product has a brand
    if (product.brandId) {
      whereConditions.push({ brandId: product.brandId });
    }

    // If no category or brand, fallback to any active products
    const where: Prisma.ProductWhereInput = {
      AND:
        whereConditions.length > 2
          ? whereConditions
          : [{ id: { not: productId } }, { isActive: true }],
    };

    // Fetch related products
    const relatedProducts = await this.prismaService.tenancy.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
      },
      orderBy: [
        // Prioritize same category and brand
        { categoryId: product.categoryId ? 'asc' : 'desc' },
        { brandId: product.brandId ? 'asc' : 'desc' },
        { createdAt: 'desc' }, // Then by newest
      ],
      take: limit,
    });

    // Cache the result
    await this.redisService.set(cacheKey, relatedProducts, CACHE_TTL);

    return relatedProducts;
  }
}
