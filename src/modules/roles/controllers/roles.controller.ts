import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';

import { RolesService } from '../services/roles.service';
import { CreateRoleDto } from '../dtos/roles.dto';
import { AuthUser } from 'params/auth-user.param';

import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { GetRolesFilterQuery } from '../dtos/get-roles-filter-query.dto';
import { Response } from 'metadatas/response.metadata';
import { RequirePermissions } from 'src/decorators/role-permission-decorator';
import {
  PermissionEnum,
  PermissionMatchModeEnum,
} from 'modules/permissions/enums/permissions.enum';
import type { User } from 'generated/prisma/client';

const rolePermissionsArray = [
  PermissionEnum.VIEW_ROLES,
  PermissionEnum.CREATE_ROLES,
  PermissionEnum.EDIT_ROLES,
  PermissionEnum.DELETE_ROLES,
];

@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Post()
  @RequirePermissions(rolePermissionsArray, PermissionMatchModeEnum.EVERY)
  @Response({
    status: HttpStatus.OK,
    message: 'Role created sucessfully',
  })
  create(@AuthUser() user: User, @Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(user?.id, dto);
  }

  @Get()
  @RequirePermissions(rolePermissionsArray, PermissionMatchModeEnum.EVERY)
  @HttpCode(HttpStatus.OK)
  // @ApiResponseOk(RoleDto)
  findAllRoles(
    @Query() paginationQueryParams: PaginationQuery,
    @Query() filterQuery: GetRolesFilterQuery,
  ) {
    return this.rolesService.getAllRoles(paginationQueryParams, filterQuery);
  }

  // @Get('/pagination')
  // @RequirePermissions(rolePermissionsArray, PermissionMatchModeEnum.EVERY)
  // @HttpCode(HttpStatus.OK)
  // // @ApiResponseOk(RoleDto)
  // getAll(
  //   @QueryFilter() filter: Record<string, any>,
  //   @QueryOptions() options: Record<string, any>,
  // ) {
  //   const roleList = this.rolesService.getAllWithUrlQuery(filter, options);

  //   const responseOkBuilder = ResponseOk.builder()
  //     .code('info')
  //     .status(200)
  //     .message('Organisations retrived');

  //   if (roleList instanceof PaginatedResult) {
  //     responseOkBuilder
  //       .filtered(roleList.filtered)
  //       .size(roleList.size)
  //       .pages(roleList.pages)
  //       .total(roleList.total)
  //       .data(roleList.data.map(RoleDto.fromModel));
  //   } else {
  //     responseOkBuilder.data(roleList);
  //   }

  //   return responseOkBuilder.build();
  // }

  @Get(':id')
  @RequirePermissions(rolePermissionsArray, PermissionMatchModeEnum.EVERY)
  findOne(@Param('id') id: string) {
    return this.rolesService.getRoleById(id);
  }

  // @Put(':id')
  // @RequirePermissions(rolePermissionsArray, PermissionMatchModeEnum.EVERY)
  // @HttpCode(HttpStatus.OK)
  // async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
  //   const role = await this.rolesService.updateRole(id, dto);

  //   return ResponseOk.builder()
  //     .code('info')
  //     .status(200)
  //     .message('Role updated')
  //     .data(RoleDto.fromModel(role))
  //     .build();
  // }

  @Delete(':id')
  @RequirePermissions(rolePermissionsArray, PermissionMatchModeEnum.EVERY)
  remove(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }

  @Delete()
  @RequirePermissions(rolePermissionsArray, PermissionMatchModeEnum.EVERY)
  deleteAll() {
    return this.rolesService.deleteAllRoles();
  }

  // @Post(':id/assign-permissions')
  // @RequirePermissions(rolePermissionsArray, PermissionMatchModeEnum.EVERY)
  // @HttpCode(HttpStatus.OK)
  // async assignPermissions(
  //   @Param('id') id: string,
  //   @Body() dto: AssignPermissionsDto,
  // ) {
  //   const role = await this.rolesService.assignPermissions(id, dto);

  //   return ResponseOk.builder()
  //     .code('info')
  //     .status(200)
  //     .message('Role assigned')
  //     .data(RoleDto.fromModel(role))
  //     .build();
  // }
}
