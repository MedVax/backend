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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserProfileType, UserType } from 'generated/prisma/enums';

import { Response } from 'metadatas/response.metadata';
import { ClientsService } from '../services/clients.service';
import { CreateClientDto } from '../dtos/create-client.dto';
import { UpdateClientDto } from '../dtos/update-client.dto';
import { GetClientDto } from '../dtos/get-client.dto';
import { AssignConsultantDto } from '../dtos/assign-consultant.dto';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import type { AuthUserType } from 'types/user.types';
import { AuthUser } from 'params/auth-user.param';

@Controller('clients')
@ApiTags('Clients')
@UseGuards(PermissionsGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Post()
  @Response({
    status: HttpStatus.CREATED,
    message: 'Client profile created successfully',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN])
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Client profiles fetched successfully',
  })
  @ApiPaginatedResponse(CreateClientDto)
  findAll(@Query() paginationQuery?: PaginationQuery) {
    return this.clientsService.findAll(paginationQuery);
  }

  @Get(':id')
  @Response({
    status: HttpStatus.OK,
    message: 'Client profile fetched successfully',
  })
  @AuthUserGuard()
  findOne(@Param() params: GetClientDto) {
    return this.clientsService.findOneOrThrow(params.id);
  }

  @Put()
  @Response({
    status: HttpStatus.OK,
    message: 'Client profile updated successfully',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN, UserProfileType.CLIENT])
  update(@AuthUser() user: AuthUserType, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(user, dto);
  }

  @Delete(':id')
  @Response({
    status: HttpStatus.OK,
    message: 'Client profile deleted successfully',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN])
  remove(@Param() params: GetClientDto) {
    return this.clientsService.remove(params.id);
  }

  @Patch('assign-consultant')
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant assignment updated successfully',
  })
  @ApiOperation({
    summary: 'Assign or change consultant for a client',
    description:
      'Assigns, changes, or removes consultant for a client. Pass consultantId in body to assign/change, or null/omit to remove.',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN, UserProfileType.CLIENT])
  assignConsultant(@Body() dto: AssignConsultantDto) {
    return this.clientsService.assignConsultant(
      dto.clientId,
      dto.consultantId ?? null,
    );
  }
}
