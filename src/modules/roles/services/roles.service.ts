import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionsDto,
} from '../dtos/roles.dto';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import UserService from 'modules/user/services/user.service';
import type { Prisma, Role, User } from 'generated/prisma/client';
import { QueryFilter, QueryOptions } from 'libs/url-to-db-query';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { GetRolesFilterQuery } from '../dtos/get-roles-filter-query.dto';
import { PermissionEnum } from 'modules/permissions/enums/permissions.enum';

@Injectable()
export class RolesService {
  constructor(
    private prismaService: PrismaTenancyService,
    private userService: UserService,
  ) {}
  private logger = new Logger();

  async createRole(userId: string, data: CreateRoleDto) {
    const { name, description, permissionIds } = data;
    await this.userService.findOneOrThrow(userId);

    const existingRole =
      await this.prismaService.corePrismaService.role.findFirst({
        where: {
          name,
        },
      });

    if (existingRole) {
      throw new ConflictException(`Role with name ${name} already exists`);
    }

    // Validate permissions if provided
    if (permissionIds && permissionIds.length > 0) {
      const existingPermissions =
        await this.prismaService.corePrismaService.permission.findMany({
          where: { id: { in: permissionIds } },
          select: { id: true },
        });

      const validPermissionIds = existingPermissions.map((p) => p.id);
      const invalidPermissions = permissionIds.filter(
        (id) => !validPermissionIds.includes(id),
      );

      if (invalidPermissions.length > 0) {
        throw new BadRequestException(
          `Invalid permission IDs: ${invalidPermissions.join(', ')}`,
        );
      }
    }

    // Create the role
    const role = await this.prismaService.corePrismaService.role.create({
      data: {
        name,
        description,
      },
    });

    // Assign permissions if provided
    if (role && permissionIds && permissionIds.length > 0) {
      await this.assignPermissions(role?.id, { permissionIds });
    }

    return role;
  }

  async getAllRoles(
    paginationQueryParams: PaginationQuery,
    filterQueryParams: GetRolesFilterQuery,
  ) {
    const { search, organizationId } = filterQueryParams;
    const where: Prisma.RoleWhereInput = {
      AND: [
        search
          ? {
              OR: [
                search
                  ? { name: { contains: search, mode: 'insensitive' } }
                  : {},
              ],
            }
          : {},
      ],
      ...(organizationId && { organizationId }),
    };

    const roles = await this.prismaService.tenancy.role.paginate({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...paginationQueryParams,
    });

    return roles;
  }

  async getAllWithUrlQuery(
    filter?: QueryFilter<Role>,
    options?: QueryOptions<Role>,
  ) {
    return this.prismaService.tenancy.role.findManyWithUrlQuery(
      filter,
      options,
    );
  }

  async getRoleById(id: string) {
    const role = await this.prismaService.tenancy.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async updateRole(id: string, data: UpdateRoleDto) {
    const { permissionIds, ...roleData } = data;

    const role = await this.prismaService.tenancy.role.findUnique({
      where: { id },
    });

    if (!role) throw new NotFoundException('Role not found');

    const updatedRole = await this.prismaService.corePrismaService.role.update({
      where: { id },
      data: roleData,
    });

    if (permissionIds && permissionIds.length > 0) {
      // Delete old permissions
      await this.prismaService.corePrismaService.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // Re-assign new permissions
      const newPermissions = permissionIds.map((permissionId) => ({
        roleId: id,
        permissionId,
      }));

      await this.prismaService.corePrismaService.rolePermission.createMany({
        data: newPermissions,
      });
    }

    return updatedRole;
  }

  async deleteRole(id: string) {
    return this.prismaService.corePrismaService.role.delete({ where: { id } });
  }

  async deleteAllRoles() {
    return this.prismaService.corePrismaService.$transaction([
      this.prismaService.corePrismaService.userRole.deleteMany(),
      this.prismaService.corePrismaService.rolePermission.deleteMany(),
      this.prismaService.corePrismaService.role.deleteMany(),
    ]);
  }

  async assignPermissions(roleId: string, dto: AssignPermissionsDto) {
    const role = await this.prismaService.corePrismaService.role.findUnique({
      where: { id: roleId },
    });

    if (!role) throw new NotFoundException('Role not found');

    await this.prismaService.corePrismaService.rolePermission.deleteMany({
      where: { roleId },
    });

    const permissions = dto.permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    await this.prismaService.corePrismaService.rolePermission.createMany({
      data: permissions,
    });

    return role;
  }

  async attachAllAccessRole(user: User) {
    // Get the all access permission
    const permissionId = await this.prismaService.corePrismaService.permission
      .findFirst({
        where: {
          value: PermissionEnum.ALL_ACCESS,
        },
      })
      .catch(() => {
        throw new NotFoundException(
          `Permission with value "${PermissionEnum.ALL_ACCESS}" not found`,
        );
      });

    const defaultRoleDetails = {
      name: 'Admin',
      description:
        'This role has all access to the system and can manage all aspects of the organization.',
      userId: user.id,
      permissionIds: [permissionId?.id],
    };

    const role = await this.createRole(user?.id, defaultRoleDetails);

    if (!role?.id) {
      throw new BadRequestException('Failed to create default role');
    }

    await this.prismaService.corePrismaService.userRole.create({
      data: {
        user: {
          connect: {
            id: user?.id,
          },
        },
        role: {
          connect: { id: role?.id },
        },
      },
    });
  }
}
