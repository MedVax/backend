import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from '../services/subscriptions.service';
import { CreateSubscriptionDto } from '../dtos/create-subscription.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { UserType } from 'generated/prisma/enums';

@Controller('subscriptions')
@ApiTags('Subscriptions')
@UseGuards(PermissionsGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @AuthUserGuard()
  @Response({
    status: HttpStatus.CREATED,
    message: 'Subscription created successfully',
  })
  @ApiOperation({ summary: 'Create a new subscription' })
  create(@Body() dto: CreateSubscriptionDto, @AuthUser() user: User) {
    return this.subscriptionsService.create(user.id, dto);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Subscriptions fetched successfully',
  })
  @ApiOperation({ summary: 'Get all subscriptions' })
  findAll(@AuthUser() user?: User) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.subscriptionsService.findAll(userId);
  }

  @Get(':id')
  @Response({
    status: HttpStatus.OK,
    message: 'Subscription fetched successfully',
  })
  @ApiOperation({ summary: 'Get a subscription by ID' })
  findOne(@Param('id') id: string, @AuthUser() user?: User) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.subscriptionsService.findOne(id, userId);
  }

  @Put(':id/pause')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Subscription paused successfully',
  })
  @ApiOperation({ summary: 'Pause a subscription' })
  pause(@Param('id') id: string, @AuthUser() user: User) {
    return this.subscriptionsService.pause(id, user.id);
  }

  @Put(':id/resume')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Subscription resumed successfully',
  })
  @ApiOperation({ summary: 'Resume a subscription' })
  resume(@Param('id') id: string, @AuthUser() user: User) {
    return this.subscriptionsService.resume(id, user.id);
  }

  @Delete(':id')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Subscription deleted successfully',
  })
  @ApiOperation({ summary: 'Delete a subscription' })
  remove(@Param('id') id: string, @AuthUser() user: User) {
    return this.subscriptionsService.remove(id, user.id);
  }
}
