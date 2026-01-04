import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpStatus,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StockService } from '../services/stock.service';
import { AdjustStockDto } from '../dtos/adjust-stock.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { UserType } from 'generated/prisma/enums';
import { PermissionsGuard } from 'src/guards/permission.guard';

@Controller('stock')
@ApiTags('Stock')
@UseGuards(PermissionsGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('product/:productId')
  @Response({ status: HttpStatus.OK, message: 'Stock fetched successfully' })
  @ApiOperation({
    summary: 'Get product stock (cached for high-traffic products)',
  })
  getStock(@Param('productId') productId: string) {
    return this.stockService.getStock(productId);
  }

  @Post('product/:productId/validate')
  @Response({ status: HttpStatus.OK, message: 'Stock validated successfully' })
  @ApiOperation({ summary: 'Validate stock availability for items' })
  validateStock(
    @Param('productId') productId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.stockService.validateStock([{ productId, quantity }]);
  }

  @Patch('product/:productId/adjust')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Stock adjusted successfully' })
  @ApiOperation({ summary: 'Manually adjust stock (Admin only)' })
  adjustStock(
    @Param('productId') productId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.stockService.adjustStock(productId, dto.quantity, dto.reason);
  }

  @Post('reconcile')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Reconciliation scheduled' })
  @ApiOperation({ summary: 'Schedule stock reconciliation (Admin only)' })
  scheduleReconciliation(@Body('productId') productId?: string) {
    return this.stockService.scheduleReconciliation(productId);
  }
}
