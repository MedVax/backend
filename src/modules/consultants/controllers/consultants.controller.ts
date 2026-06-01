import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserProfileType, UserType } from 'generated/prisma/enums';

import { Response } from 'metadatas/response.metadata';
import { ConsultantsService } from '../services/consultants.service';
import { CreateConsultantDto } from '../dtos/create-consultant.dto';
import { UpdateConsultantDto } from '../dtos/update-consultant.dto';
import { GetConsultantDto } from '../dtos/get-consultant.dto';
import { UpdateConsultantStatusDto } from '../dtos/update-consultant-status.dto';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { AuthUser } from 'params/auth-user.param';
import type { AuthUserType } from 'types/user.types';
import { AuthAllow } from 'metadatas/auth-allow.metadata';

@Controller('consultants')
@ApiTags('Consultants')
@UseGuards(PermissionsGuard)
export class ConsultantsController {
  constructor(private consultantsService: ConsultantsService) {}

  @Post()
  @Response({
    status: HttpStatus.CREATED,
    message: 'Consultant profile created successfully',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN])
  create(@Body() dto: CreateConsultantDto) {
    return this.consultantsService.create(dto);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant profiles fetched successfully',
  })
  @ApiPaginatedResponse(CreateConsultantDto)
  findAll(@Query() paginationQuery?: PaginationQuery) {
    return this.consultantsService.findAll(paginationQuery);
  }

  @Get(':id')
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant profile fetched successfully',
  })
  @AuthAllow()
  findOne(@Param() params: GetConsultantDto) {
    return this.consultantsService.findOneOrThrow(params.id);
  }

  @Put()
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant profile updated successfully',
  })
  @AuthUserGuard([
    UserType.SUPER_ADMIN,
    UserType.ADMIN,
    UserProfileType.CONSULTANT,
  ])
  update(@AuthUser() user: AuthUserType, @Body() dto: UpdateConsultantDto) {
    return this.consultantsService.update(user, dto);
  }

  @Patch(':id/status')
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant status updated successfully',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN])
  updateStatus(
    @Param() params: GetConsultantDto,
    @Body() dto: UpdateConsultantStatusDto,
  ) {
    return this.consultantsService.updateStatus(params.id, dto);
  }

  @Delete(':id')
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant profile deleted successfully',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN])
  remove(@Param() params: GetConsultantDto) {
    return this.consultantsService.remove(params.id);
  }
}
