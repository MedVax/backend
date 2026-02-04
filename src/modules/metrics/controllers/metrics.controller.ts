import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetricsService } from '../services/metrics.service';
import { Response } from 'metadatas/response.metadata';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { UserType } from 'generated/prisma/enums';
import { GetReviewMetricsDto } from '../dtos/get-review-metrics.dto';
import { GetDashboardMetricsDto } from '../dtos/get-dashboard-metrics.dto';

@Controller('metrics')
@ApiTags('Metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('admin-dashboard')
  @Response({
    status: HttpStatus.OK,
    message: 'Admin dashboard metrics fetched successfully',
  })
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @ApiOperation({
    summary: 'Get admin dashboard metrics',
    description:
      'Get comprehensive e-commerce dashboard metrics with optional date range filtering',
  })
  async getAdminDashboardMetrics(@Query() query: GetDashboardMetricsDto) {
    return this.metricsService.getAdminDashboardMetrics(query);
  }

  @Get('products')
  @Response({
    status: HttpStatus.OK,
    message: 'Product metrics fetched successfully',
  })
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @ApiOperation({ summary: 'Get product metrics' })
  async getProductMetrics() {
    return this.metricsService.getProductMetrics();
  }

  @Get('reviews')
  @Response({
    status: HttpStatus.OK,
    message: 'Review metrics fetched successfully',
  })
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @ApiOperation({
    summary: 'Get review metrics with date filtering',
    description:
      'Get review metrics for a date range. If no dates provided, defaults to last 30 days.',
  })
  async getReviewMetrics(@Query() query: GetReviewMetricsDto) {
    return this.metricsService.getReviewMetrics(query);
  }
}
