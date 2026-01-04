import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrescriptionsService } from '../services/prescriptions.service';
import { CreatePrescriptionDto } from '../dtos/create-prescription.dto';
import { VerifyPrescriptionDto } from '../dtos/verify-prescription.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { QueryFilter } from 'params/query-filter';
import { QueryOptions } from 'params/query-options';
import { UserType } from 'generated/prisma/enums';

@Controller('prescriptions')
@ApiTags('Prescriptions')
@UseGuards(PermissionsGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @AuthUserGuard()
  @Response({
    status: HttpStatus.CREATED,
    message: 'Prescription created successfully',
  })
  @ApiOperation({ summary: 'Create/upload a prescription' })
  create(@Body() dto: CreatePrescriptionDto, @AuthUser() user: User) {
    return this.prescriptionsService.create(user.id, dto);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Prescriptions fetched successfully',
  })
  @ApiOperation({ summary: 'Get all prescriptions' })
  findAll(
    @QueryFilter() filter: Record<string, any>,
    @QueryOptions() options: Record<string, any>,
    @Query() query: PaginationQuery,
    @AuthUser() user?: User,
  ) {
    // If user is not admin/clinician, only show their prescriptions
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.prescriptionsService.findAll(userId, filter, options);
  }

  @Get('count')
  @Response({
    status: HttpStatus.OK,
    message: 'Prescriptions count fetched successfully',
  })
  @ApiOperation({ summary: 'Get prescriptions count' })
  count(
    @QueryFilter() filter: Record<string, any>,
    @QueryOptions() options: Record<string, any>,
    @AuthUser() user?: User,
  ) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.prescriptionsService.count(userId, filter, options);
  }

  @Get(':id')
  @Response({
    status: HttpStatus.OK,
    message: 'Prescription fetched successfully',
  })
  @ApiOperation({ summary: 'Get a prescription by ID' })
  findOne(@Param('id') id: string, @AuthUser() user?: User) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.prescriptionsService.findOne(id, userId);
  }

  @Patch(':id/verify')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.OK,
    message: 'Prescription verified successfully',
  })
  @ApiOperation({
    summary: 'Verify/Review a prescription (Admin/Clinician only)',
  })
  verify(
    @Param('id') id: string,
    @Body() dto: VerifyPrescriptionDto,
    @AuthUser() user: User,
  ) {
    return this.prescriptionsService.verify(id, dto, user.id);
  }

  @Delete(':id')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Prescription deleted successfully',
  })
  @ApiOperation({ summary: 'Delete a prescription' })
  remove(@Param('id') id: string, @AuthUser() user: User) {
    return this.prescriptionsService.remove(id, user.id);
  }
}
