import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { STOCK } from 'constants/queue.constant';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { StockService } from '../services/stock.service';
import { StockMovementType } from 'generated/prisma/enums';

@Processor(STOCK)
export class StockProcessor extends WorkerHost {
  private logger = new Logger(StockProcessor.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private stockService: StockService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing stock job: ${job.name} - ${job.id}`);

    try {
      switch (job.name) {
        case 'reconcile-stock':
          await this.reconcileStock(job);
          break;
        case 'low-stock-alert':
          await this.lowStockAlert(job);
          break;
        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing stock job ${job.name}: ${error.message}`,
      );
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Stock job active: ${job.name} - ${job.id}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Stock job completed: ${job.name} - ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Stock job failed: ${job.name} - ${job.id} - ${error.message}`,
    );
  }

  /**
   * Reconcile stock by recalculating from StockMovement table
   * This ensures data integrity and catches any discrepancies
   */
  private async reconcileStock(
    job: Job<{ productId?: string }>,
  ): Promise<void> {
    const { productId } = job.data;

    this.logger.log(
      `Starting stock reconciliation${productId ? ` for product ${productId}` : ' (all products)'}`,
    );

    const where = productId ? { id: productId } : {};

    const products = await this.prismaService.tenancy.product.findMany({
      where,
      select: { id: true, sku: true },
    });

    for (const product of products) {
      try {
        // Calculate actual stock from movements
        const movements =
          await this.prismaService.tenancy.stockMovement.findMany({
            where: { productId: product.id },
            orderBy: { createdAt: 'asc' },
          });

        // Calculate current state from movements
        let calculatedQuantity = 0;
        let calculatedReserved = 0;

        for (const movement of movements) {
          switch (movement.type) {
            case StockMovementType.RESERVE:
              calculatedReserved += movement.quantity;
              break;
            case StockMovementType.COMMIT:
              calculatedReserved -= Math.abs(movement.quantity);
              calculatedQuantity -= Math.abs(movement.quantity);
              break;
            case StockMovementType.RELEASE:
              calculatedReserved -= Math.abs(movement.quantity);
              break;
            case StockMovementType.ADJUSTMENT:
              calculatedQuantity += movement.quantity;
              break;
            case StockMovementType.RECONCILIATION:
              // Reconciliation movements are snapshots, use them as truth
              calculatedQuantity = movement.quantityAfter;
              calculatedReserved = movement.reservedAfter || 0;
              break;
          }
        }

        // Get current product state
        const current = await this.prismaService.tenancy.product.findUnique({
          where: { id: product.id },
          select: {
            stockQuantity: true,
            stockReserved: true,
            version: true,
          },
        });

        if (!current) continue;

        // Check for discrepancies
        const quantityDiff = current.stockQuantity - calculatedQuantity;
        const reservedDiff = current.stockReserved - calculatedReserved;

        if (quantityDiff !== 0 || reservedDiff !== 0) {
          this.logger.warn(
            `Stock discrepancy detected for product ${product.sku}: ` +
              `Quantity diff: ${quantityDiff}, Reserved diff: ${reservedDiff}`,
          );

          // Create reconciliation record
          await this.prismaService.tenancy.stockMovement.create({
            data: {
              productId: product.id,
              type: StockMovementType.RECONCILIATION,
              quantity: calculatedQuantity - current.stockQuantity,
              reservedBefore: current.stockReserved,
              reservedAfter: calculatedReserved,
              quantityBefore: current.stockQuantity,
              quantityAfter: calculatedQuantity,
              reason: `Reconciliation: Corrected quantity (diff: ${quantityDiff}), reserved (diff: ${reservedDiff})`,
            },
          });

          // Update product with corrected values
          await this.prismaService.tenancy.product.update({
            where: { id: product.id },
            data: {
              stockQuantity: calculatedQuantity,
              stockReserved: calculatedReserved,
              version: { increment: 1 },
            },
          });

          // Invalidate cache
          await this.stockService.invalidateCache(product.id);

          this.logger.log(
            `Stock reconciled for product ${product.sku}: ` +
              `Quantity: ${current.stockQuantity} → ${calculatedQuantity}, ` +
              `Reserved: ${current.stockReserved} → ${calculatedReserved}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error reconciling stock for product ${product.sku}: ${error.message}`,
        );
        // Continue with other products
      }
    }

    this.logger.log('Stock reconciliation completed');
  }

  /**
   * Check for low stock and send alerts
   */
  private async lowStockAlert(
    job: Job<{ productId: string; threshold: number }>,
  ): Promise<void> {
    const { productId, threshold } = job.data;

    const stock = await this.stockService.getStock(productId);

    if (stock.available <= threshold) {
      const product = await this.prismaService.tenancy.product.findUnique({
        where: { id: productId },
        select: { name: true, sku: true },
      });

      this.logger.warn(
        `Low stock alert for product ${product?.sku}: ` +
          `Available: ${stock.available}, Threshold: ${threshold}`,
      );

      // TODO: Send notification (email, SMS, etc.)
      // await this.notificationService.sendLowStockAlert(product, stock);
    }
  }
}
