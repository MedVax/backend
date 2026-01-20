import {
  Controller,
  Get,
  Param,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TransactionsService } from '../services/transactions.service';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { QueryFilter } from 'params/query-filter';
import { QueryOptions } from 'params/query-options';
import { UserType } from 'generated/prisma/enums';

@Controller('transactions')
@ApiTags('Transactions')
@UseGuards(PermissionsGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Transactions fetched successfully',
  })
  @ApiOperation({ summary: 'Get all transactions' })
  async findAll(
    @QueryFilter() filter: Record<string, any>,
    @QueryOptions() options: Record<string, any>,
    @Query() query: PaginationQuery,
    @AuthUser() user?: User,
  ) {
    // If user is not admin, only show their transactions
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.transactionsService.findAll(userId, filter, options);
  }

  @Get('statistics')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Transaction statistics fetched successfully',
  })
  @ApiOperation({ summary: 'Get transaction statistics' })
  async getStatistics(@AuthUser() user?: User) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.transactionsService.getStatistics(userId);
  }

  @Get(':id')
  @Response({
    status: HttpStatus.OK,
    message: 'Transaction fetched successfully',
  })
  @ApiOperation({ summary: 'Get a transaction by ID' })
  async findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Get('provider-reference/:reference')
  @Response({
    status: HttpStatus.OK,
    message: 'Transaction fetched successfully',
  })
  @ApiOperation({ summary: 'Get a transaction by provider reference' })
  async findByProviderReference(@Param('reference') reference: string) {
    return this.transactionsService.findByProviderReference(reference);
  }
}
