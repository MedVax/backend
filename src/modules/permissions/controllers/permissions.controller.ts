import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';

import { PermissionsService } from '../services/permissions.service';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
} from '../dtos/permissions.dto';

@Controller('permissions')
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Post()
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.createPermission(dto);
  }

  @Get()
  findAll() {
    return this.permissionsService.getAllPermissions();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.permissionsService.getPermissionById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.updatePermission(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.permissionsService.deletePermission(id);
  }

  @Delete()
  deleteAll() {
    return this.permissionsService.deleteAllPermission();
  }
}
