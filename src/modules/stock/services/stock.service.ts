import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { RedisService } from 'services/redis.service';
import { StockMovementType } from 'generated/prisma/enums';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { STOCK } from 'constants/queue.constant';

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = 'stock:product:';
const PRODUCT_CACHE_PREFIX = {
  PRODUCT_BY_ID: 'product:id:',
  PRODUCT_BY_SKU: 'product:sku:',
};
const HIGH_TRAFFIC_THRESHOLD = 100; // requests per hour

@Injectable()
export class StockService {
  private logger = new Logger(StockService.name);
  private requestCounts = new Map<string, number>();
  private timeoutIds = new Map<string, NodeJS.Timeout>();

  constructor(
    private prismaService: PrismaTenancyService,
    private redisService: RedisService,
    @InjectQueue(STOCK) private stockQueue: Queue,
  ) {}

  /**
   * Get product stock with Redis cache for high-traffic products
   * Performance: ~1ms (cached) or ~5ms (DB query)
   */
  async getStock(productId: string): Promise<{
    stockQuantity: number;
    stockReserved: number;
    available: number;
  }> {
    const cacheKey = `${CACHE_PREFIX}${productId}`;

    // Check Redis cache first
    const cached = await this.redisService.get<{
      stockQuantity: number;
      stockReserved: number;
      available: number;
    }>(cacheKey);

    if (cached) {
      this.trackRequest(productId);
      return cached;
    }

    // Cache miss - fetch from database
    const product = await this.prismaService.tenancy.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        stockQuantity: true,
        stockReserved: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const available = product.stockQuantity - product.stockReserved;
    const stockData = {
      stockQuantity: product.stockQuantity,
      stockReserved: product.stockReserved,
      available,
    };

    // Cache for high-traffic products or if requested multiple times
    if (this.isHighTraffic(productId)) {
      await this.redisService.set(cacheKey, stockData, CACHE_TTL);
    }

    return stockData;
  }

  /**
   * Reserve stock for an order (optimistic locking)
   * Performance: ~5ms (transaction with 2 inserts)
   */
  async reserveStock(
    productId: string,
    quantity: number,
    orderId: string,
    reason?: string,
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    // Retry logic for optimistic locking conflicts
    const maxRetries = 5;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const product = await this.prismaService.tenancy.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            stockQuantity: true,
            stockReserved: true,
            version: true,
          },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${productId} not found`);
        }

        const available = product.stockQuantity - product.stockReserved;

        if (available < quantity) {
          throw new BadRequestException(
            `Insufficient stock. Available: ${available}, Requested: ${quantity}`,
          );
        }

        const reservedBefore = product.stockReserved;
        const reservedAfter = reservedBefore + quantity;

        // Update with optimistic locking
        await this.prismaService.tenancy.$transaction(async (tx) => {
          // Lock row and check version
          const locked = await tx.product.findUnique({
            where: { id: productId },
            select: {
              version: true,
              stockReserved: true,
              stockQuantity: true,
            },
          });

          if (!locked || locked.version !== product.version) {
            throw new ConflictException('Version mismatch - retrying');
          }

          // Update stock
          const updatedProduct = await tx.product.update({
            where: {
              id: productId,
              version: product.version, // Optimistic lock check
            },
            data: {
              stockReserved: reservedAfter,
              version: { increment: 1 },
            },
          });

          // Create audit record
          await tx.stockMovement.create({
            data: {
              productId,
              type: StockMovementType.RESERVE,
              quantity: quantity,
              reservedBefore,
              reservedAfter,
              quantityBefore: product.stockQuantity,
              quantityAfter: product.stockQuantity,
              orderId,
              reason: reason || `Reserve for order ${orderId}`,
            },
          });

          return updatedProduct;
        });

        // Invalidate cache
        await this.invalidateCache(productId);

        this.logger.log(
          `Stock reserved: Product ${productId}, Quantity: ${quantity}, Order: ${orderId}`,
        );
        return;
      } catch (error) {
        if (error instanceof ConflictException && retries < maxRetries - 1) {
          retries++;
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 10 * retries));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Commit reserved stock (move from reserved to deducted)
   */
  async commitStock(
    productId: string,
    quantity: number,
    orderId: string,
    reason?: string,
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    let productSku: string | undefined;
    await this.prismaService.tenancy.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      productSku = product.sku;

      if (product.stockReserved < quantity) {
        throw new BadRequestException(
          `Insufficient reserved stock. Reserved: ${product.stockReserved}, Requested: ${quantity}`,
        );
      }

      const reservedBefore = product.stockReserved;
      const reservedAfter = reservedBefore - quantity;
      const quantityBefore = product.stockQuantity;
      const quantityAfter = quantityBefore - quantity;

      // Update stock
      await tx.product.update({
        where: { id: productId },
        data: {
          stockReserved: reservedAfter,
          stockQuantity: quantityAfter,
          version: { increment: 1 },
        },
      });

      // Create audit record
      await tx.stockMovement.create({
        data: {
          productId,
          type: StockMovementType.COMMIT,
          quantity: -quantity, // Negative for deduction
          reservedBefore,
          reservedAfter,
          quantityBefore,
          quantityAfter,
          orderId,
          reason: reason || `Commit for order ${orderId}`,
        },
      });
    });

    // Invalidate both stock cache and product cache
    await this.invalidateCache(productId);
    await this.invalidateProductCache(productId, productSku);
    this.logger.log(
      `Stock committed: Product ${productId}, Quantity: ${quantity}, Order: ${orderId}`,
    );
  }

  /**
   * Release reserved stock (for cancelled orders)
   */
  async releaseStock(
    productId: string,
    quantity: number,
    orderId: string,
    reason?: string,
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    let productSku: string | undefined;
    await this.prismaService.tenancy.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      productSku = product.sku;

      if (product.stockReserved < quantity) {
        throw new BadRequestException(
          `Insufficient reserved stock to release. Reserved: ${product.stockReserved}, Requested: ${quantity}`,
        );
      }

      const reservedBefore = product.stockReserved;
      const reservedAfter = reservedBefore - quantity;

      // Update stock
      await tx.product.update({
        where: { id: productId },
        data: {
          stockReserved: reservedAfter,
          version: { increment: 1 },
        },
      });

      // Create audit record
      await tx.stockMovement.create({
        data: {
          productId,
          type: StockMovementType.RELEASE,
          quantity: -quantity, // Negative for release
          reservedBefore,
          reservedAfter,
          quantityBefore: product.stockQuantity,
          quantityAfter: product.stockQuantity,
          orderId,
          reason: reason || `Release for cancelled order ${orderId}`,
        },
      });
    });

    // Invalidate both stock cache and product cache
    await this.invalidateCache(productId);
    await this.invalidateProductCache(productId, productSku);
    this.logger.log(
      `Stock released: Product ${productId}, Quantity: ${quantity}, Order: ${orderId}`,
    );
  }

  /**
   * Manual stock adjustment (admin only)
   */
  async adjustStock(
    productId: string,
    quantity: number,
    reason: string,
    createdBy?: string,
  ): Promise<void> {
    let productSku: string | undefined;
    await this.prismaService.tenancy.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      productSku = product.sku;

      const quantityBefore = product.stockQuantity;
      const quantityAfter = quantityBefore + quantity;

      // Database constraint will prevent negative stock
      if (quantityAfter < 0) {
        throw new BadRequestException(
          `Adjustment would result in negative stock. Current: ${quantityBefore}, Adjustment: ${quantity}`,
        );
      }

      // Update stock
      await tx.product.update({
        where: { id: productId },
        data: {
          stockQuantity: quantityAfter,
          version: { increment: 1 },
        },
      });

      // Create audit record
      await tx.stockMovement.create({
        data: {
          productId,
          type: StockMovementType.ADJUSTMENT,
          quantity,
          reservedBefore: product.stockReserved,
          reservedAfter: product.stockReserved,
          quantityBefore,
          quantityAfter,
          reason,
          createdBy,
        },
      });
    });

    // Invalidate both stock cache and product cache
    await this.invalidateCache(productId);
    await this.invalidateProductCache(productId, productSku);
    this.logger.log(
      `Stock adjusted: Product ${productId}, Quantity: ${quantity}, Reason: ${reason}`,
    );
  }

  /**
   * Validate stock availability for multiple products
   */
  async validateStock(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<{ productId: string; available: number; requested: number }[]> {
    const results = await Promise.all(
      items.map(async (item) => {
        const stock = await this.getStock(item.productId);
        return {
          productId: item.productId,
          available: stock.available,
          requested: item.quantity,
        };
      }),
    );

    return results;
  }

  /**
   * Schedule stock reconciliation job
   */
  async scheduleReconciliation(productId?: string): Promise<void> {
    await this.stockQueue.add('reconcile-stock', {
      productId,
      scheduledAt: new Date().toISOString(),
    });
  }

  /**
   * Schedule low stock alert job
   */
  async scheduleLowStockAlert(
    productId: string,
    threshold: number,
  ): Promise<void> {
    await this.stockQueue.add('low-stock-alert', {
      productId,
      threshold,
      scheduledAt: new Date().toISOString(),
    });
  }

  /**
   * Check if product is high-traffic for caching decisions
   */
  private isHighTraffic(productId: string): boolean {
    const count = this.requestCounts.get(productId) || 0;
    return count >= HIGH_TRAFFIC_THRESHOLD;
  }

  /**
   * Track request count for caching decisions
   */
  private trackRequest(productId: string): void {
    const current = this.requestCounts.get(productId) || 0;
    this.requestCounts.set(productId, current + 1);

    // Reset counter periodically (every hour)
    // Store timeout ID to prevent memory leaks
    if (current === 0) {
      const timeoutId = setTimeout(() => {
        this.requestCounts.delete(productId);
        // Clean up timeout reference
        if (this.timeoutIds.has(productId)) {
          this.timeoutIds.delete(productId);
        }
      }, 3600000);
      this.timeoutIds.set(productId, timeoutId);
    }
  }

  /**
   * Invalidate Redis cache for a product (stock cache)
   */
  async invalidateCache(productId: string): Promise<void> {
    const cacheKey = `${CACHE_PREFIX}${productId}`;
    await this.redisService.delete(cacheKey);
  }

  /**
   * Invalidate product cache (used by ProductsService)
   */
  private async invalidateProductCache(
    productId: string,
    sku?: string,
  ): Promise<void> {
    try {
      await this.redisService.delete(
        `${PRODUCT_CACHE_PREFIX.PRODUCT_BY_ID}${productId}`,
      );
      if (sku) {
        await this.redisService.delete(
          `${PRODUCT_CACHE_PREFIX.PRODUCT_BY_SKU}${sku}`,
        );
      }
      this.logger.debug(`Invalidated product cache for: ${productId}`);
    } catch (error) {
      this.logger.error(
        `Error invalidating product cache for ${productId}:`,
        error,
      );
    }
  }
}
