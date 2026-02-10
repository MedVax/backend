import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { UpdateOrderStatusDto } from '../dtos/update-order-status.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { UserType } from 'generated/prisma/enums';
import { GetOrdersFilterQuery } from '../dtos/get-orders-filter-query.dto';
import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';
import { AuthAllow } from 'metadatas/auth-allow.metadata';
import { Req, Res } from '@nestjs/common';
import type { Request, Response as ExpressResponse } from 'express';
import { SessionCookieService } from 'services/session-cookie.service';

@Controller('orders')
@ApiTags('Orders')
@UseGuards(PermissionsGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly sessionCookieService: SessionCookieService,
  ) { }

  @Post()
  @AuthAllow()
  @Response({
    status: HttpStatus.CREATED,
    message: 'Order created successfully',
  })
  @ApiOperation({
    summary: 'Create a new order from cart (authenticated or anonymous)',
  })
  create(
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
    @AuthUser() user?: User,
  ) {
    const userId = user?.id;
    const sessionId = userId
      ? undefined
      : this.sessionCookieService.getOrCreateSessionId(req, res);
    return this.ordersService.create(userId, sessionId, dto);
  }

  @Get()
  @Response({ status: HttpStatus.OK, message: 'Orders fetched successfully' })
  @ApiOperation({ summary: 'Get all orders' })
  @ApiPaginatedResponse(null) // You can create an OrderDataDto if needed
  findAll(
    @Query() paginationQueryParams: PaginationQuery,
    @Query() filterQuery: GetOrdersFilterQuery,
    @AuthUser() user?: User,
  ) {
    // If user is not admin, only show their orders
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.ordersService.findAll(
      paginationQueryParams,
      filterQuery,
      userId,
    );
  }

  @Get('count')
  @Response({
    status: HttpStatus.OK,
    message: 'Orders count fetched successfully',
  })
  @ApiOperation({ summary: 'Get orders count' })
  count(@Query() filterQuery: GetOrdersFilterQuery, @AuthUser() user?: User) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.ordersService.count(filterQuery, userId);
  }

  @Get(':id')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Order fetched successfully' })
  @ApiOperation({ summary: 'Get an order by ID (authenticated or anonymous)' })
  findOne(@Param('id') id: string, @AuthUser() user?: User) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.ordersService.findOne(id, userId);
  }

  @Patch(':id/status')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.OK,
    message: 'Order status updated successfully',
  })
  @ApiOperation({ summary: 'Update order status (Admin only)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @AuthUser() user: User,
  ) {
    return this.ordersService.updateStatus(id, dto, user.id);
  }

  @Post(':id/cancel')
  @AuthUserGuard()
  @Response({ status: HttpStatus.OK, message: 'Order cancelled successfully' })
  @ApiOperation({ summary: 'Cancel an order' })
  cancel(@Param('id') id: string, @AuthUser() user: User) {
    return this.ordersService.cancel(id, user.id);
  }

  @Post(':id/resend-invoice')
  @AuthUserGuard()
  @Response({ status: HttpStatus.OK, message: 'Invoice sent successfully' })
  @ApiOperation({ summary: 'Resend order invoice' })
  resendInvoice(@Param('id') id: string, @AuthUser() user: User) {
    return this.ordersService.resendInvoice(id, user.id);
  }

  @Post('verify-payment/:reference')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Payment verified successfully' })
  @ApiOperation({
    summary: 'Verify payment for an order (authenticated or anonymous)',
  })
  verifyPayment(@Param('reference') reference: string) {
    return this.ordersService.verifyPayment(reference);
  }
}
