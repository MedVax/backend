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
import { PharmacyService } from '../services/pharmacy.service';
import { CreatePharmacyDto } from '../dtos/create-pharmacy.dto';
import { UpdatePharmacyDto } from '../dtos/update-pharmacy.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { UserType } from 'generated/prisma/enums';

@Controller('pharmacies')
@ApiTags('Pharmacies')
@UseGuards(PermissionsGuard)
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Post()
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.CREATED,
    message: 'Pharmacy created successfully',
  })
  @ApiOperation({ summary: 'Create a new pharmacy (Admin only)' })
  create(@Body() dto: CreatePharmacyDto, @AuthUser() user: User) {
    return this.pharmacyService.create(user.id, dto);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Pharmacies fetched successfully',
  })
  @ApiOperation({ summary: 'Get all active pharmacies' })
  findAll() {
    return this.pharmacyService.findAll();
  }

  @Get('my-pharmacies')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'User pharmacies fetched successfully',
  })
  @ApiOperation({ summary: 'Get pharmacies owned by current user' })
  findByOwner(@AuthUser() user: User) {
    return this.pharmacyService.findByOwner(user.id);
  }

  @Get(':id')
  @Response({ status: HttpStatus.OK, message: 'Pharmacy fetched successfully' })
  @ApiOperation({ summary: 'Get a pharmacy by ID' })
  findOne(@Param('id') id: string) {
    return this.pharmacyService.findOne(id);
  }

  @Get(':id/orders')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Pharmacy orders fetched successfully',
  })
  @ApiOperation({ summary: 'Get orders for a pharmacy' })
  getOrders(@Param('id') id: string, @Query('status') status?: string) {
    return this.pharmacyService.getOrders(id, status);
  }

  @Patch(':id')
  @AuthUserGuard()
  @Response({ status: HttpStatus.OK, message: 'Pharmacy updated successfully' })
  @ApiOperation({ summary: 'Update a pharmacy' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePharmacyDto,
    @AuthUser() user: User,
  ) {
    return this.pharmacyService.update(id, dto, user.id);
  }

  @Delete(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Pharmacy deleted successfully' })
  @ApiOperation({ summary: 'Delete a pharmacy (Admin only)' })
  remove(@Param('id') id: string) {
    return this.pharmacyService.remove(id);
  }
}
