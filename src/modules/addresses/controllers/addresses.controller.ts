import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AddressesService } from '../services/addresses.service';
import { CreateAddressDto } from '../dtos/create-address.dto';
import { UpdateAddressDto } from '../dtos/update-address.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';

@Controller('addresses')
@ApiTags('Addresses')
@UseGuards(PermissionsGuard)
@AuthUserGuard()
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @Response({
    status: HttpStatus.CREATED,
    message: 'Address created successfully',
  })
  @ApiOperation({ summary: 'Create a new address' })
  create(@Body() dto: CreateAddressDto, @AuthUser() user: User) {
    return this.addressesService.create(user.id, dto);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Addresses fetched successfully',
  })
  @ApiOperation({ summary: 'Get all user addresses' })
  findAll(@AuthUser() user: User) {
    return this.addressesService.findAll(user.id);
  }

  @Get('default')
  @Response({
    status: HttpStatus.OK,
    message: 'Default address fetched successfully',
  })
  @ApiOperation({ summary: 'Get default address' })
  getDefault(@AuthUser() user: User) {
    return this.addressesService.getDefault(user.id);
  }

  @Get(':id')
  @Response({ status: HttpStatus.OK, message: 'Address fetched successfully' })
  @ApiOperation({ summary: 'Get an address by ID' })
  findOne(@Param('id') id: string, @AuthUser() user: User) {
    return this.addressesService.findOne(id, user.id);
  }

  @Patch(':id')
  @Response({ status: HttpStatus.OK, message: 'Address updated successfully' })
  @ApiOperation({ summary: 'Update an address' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
    @AuthUser() user: User,
  ) {
    return this.addressesService.update(id, user.id, dto);
  }

  @Put(':id/default')
  @Response({
    status: HttpStatus.OK,
    message: 'Default address set successfully',
  })
  @ApiOperation({ summary: 'Set address as default' })
  setDefault(@Param('id') id: string, @AuthUser() user: User) {
    return this.addressesService.setDefault(id, user.id);
  }

  @Delete(':id')
  @Response({ status: HttpStatus.OK, message: 'Address deleted successfully' })
  @ApiOperation({ summary: 'Delete an address' })
  remove(@Param('id') id: string, @AuthUser() user: User) {
    return this.addressesService.remove(id, user.id);
  }
}
