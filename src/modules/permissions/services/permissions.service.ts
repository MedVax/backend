import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
} from '../dtos/permissions.dto';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prismaService: PrismaService) {}

  async createPermission(data: CreatePermissionDto) {
    return this.prismaService.permission.create({ data });
  }

  async getAllPermissions() {
    return this.prismaService.permission.findMany();
  }

  async getPermissionById(id: string) {
    const permission = await this.prismaService.permission.findUnique({
      where: { id },
    });
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  async updatePermission(id: string, data: UpdatePermissionDto) {
    return this.prismaService.permission.update({
      where: { id },
      data,
    });
  }

  async deletePermission(id: string) {
    return this.prismaService.permission.delete({ where: { id } });
  }

  async deleteAllPermission() {
    return this.prismaService.permission.deleteMany();
  }
}
