import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetricsService } from '../services/metrics.service';
import { Response } from 'metadatas/response.metadata';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { UserType } from 'generated/prisma/enums';
import { GetReviewMetricsDto } from '../dtos/get-review-metrics.dto';
import { GetDashboardMetricsDto } from '../dtos/get-dashboard-metrics.dto';
import { GetUserMetricsDto } from '../dtos/get-user-metrics.dto';

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

  @Get('orders')
  @Response({
    status: HttpStatus.OK,
    message: 'Order metrics fetched successfully',
  })
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @ApiOperation({
    summary: 'Get order metrics',
    description:
      'Store-wide order counts and paid revenue, independent of any list paging or filters.',
  })
  async getOrderMetrics() {
    return this.metricsService.getOrderMetrics();
  }

  @Get('users')
  @Response({
    status: HttpStatus.OK,
    message: 'User metrics fetched successfully',
  })
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @ApiOperation({
    summary: 'Get user metrics',
    description:
      'User counts, optionally restricted to one or more user types (e.g. ?type=ADMIN&type=SUPER_ADMIN).',
  })
  async getUserMetrics(@Query() query: GetUserMetricsDto) {
    return this.metricsService.getUserMetrics(query);
  }

  @Get('clients')
  @Response({
    status: HttpStatus.OK,
    message: 'Client metrics fetched successfully',
  })
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @ApiOperation({ summary: 'Get client metrics' })
  async getClientMetrics() {
    return this.metricsService.getClientMetrics();
  }

  @Get('consultants')
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant metrics fetched successfully',
  })
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @ApiOperation({ summary: 'Get consultant metrics' })
  async getConsultantMetrics() {
    return this.metricsService.getConsultantMetrics();
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
