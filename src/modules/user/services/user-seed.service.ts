import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserStatus, UserType } from 'generated/prisma/enums';

import {
  SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_EMAIL,
} from 'constants/env.constant';
import { PrismaService } from 'src/database/prisma.service';

import { BcryptService } from 'services/bcrypt.service';
import { AvatarService } from 'services/avatar.service';
import { randomUUID } from 'crypto';
import { PermissionEnum } from 'modules/permissions/enums/permissions.enum';
import { formatPermission } from 'modules/permissions/helpers/permissions.helper';

@Injectable()
export class UserSeedService {
  constructor(
    private prismaService: PrismaService,
    private bcryptService: BcryptService,
    private avatarService: AvatarService,
  ) {}

  private logger = new Logger();

  async seedPermissions() {
    this.logger.log('Running Permission seeder');

    const permissions = Object.values(PermissionEnum).map(formatPermission);

    try {
      await this.prismaService.permission.createMany({
        data: permissions,
        skipDuplicates: true,
      });

      this.logger.log('Seeding completed!');
    } catch (error) {
      this.logger.error(`Permission Seeder Error: ${error?.message}`);
    }
  }

  async seedSuperAdminRoles() {
    this.logger.log('Checking if seeding is necessary...');
    const superAdminRoleName = 'Super Admin';

    const adminRoleExists = await this.prismaService.role.findFirst({
      where: {
        name: superAdminRoleName,
      },
    });

    if (adminRoleExists) {
      this.logger.log('Super Admin Roles already exist. Skipping seeding.');
      return;
    }

    this.logger.log('Running Super Amin Role seeder');

    const adminRoles = [
      {
        name: superAdminRoleName,
        description: 'Super Admin with full access',
        organizationId: null,
      },
    ];

    const allSuperAminUsers = await this.prismaService.user.findMany({
      where: {
        type: UserType.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    if (allSuperAminUsers.length === 0) {
      this.logger.log('No super admin users found. Skipping seeding.');
      return;
    }

    try {
      const roles = await Promise.all(
        adminRoles.map((role) =>
          this.prismaService.role.upsert({
            where: {
              name: role.name,
            },
            update: {},
            create: role,
          }),
        ),
      );

      const allAccessPermission = await this.prismaService.permission.findFirst(
        {
          where: {
            value: PermissionEnum.ALL_ACCESS,
          },
        },
      );

      if (!allAccessPermission) {
        this.logger.error('Permission ALL_ACCESS not found');
        return;
      }

      await this.prismaService.rolePermission.createMany({
        data: [
          ...roles.map((role) => ({
            roleId: role.id,
            permissionId: allAccessPermission.id,
          })),
        ],
      });

      for (const user of allSuperAminUsers) {
        await this.prismaService.userRole.createMany({
          data: roles.map((role) => ({
            userId: user.id,
            roleId: role.id,
          })),
        });
      }
    } catch (error) {
      this.logger.error(`Admin Role Seeder Error: ${error?.message}`);
    }
  }

  async addSuperAdmin() {
    this.logger.log('prismaService:', this.prismaService);

    const user = await this.prismaService.user.findFirst({
      where: {
        type: UserType.SUPER_ADMIN,
        email: SUPER_ADMIN_EMAIL,
      },
    });

    if (user) return;

    const avatar = this.avatarService.create(randomUUID());

    await this.prismaService.user.create({
      data: {
        firstName: 'Super',
        lastName: 'Admin',
        avatar,
        email: SUPER_ADMIN_EMAIL,
        password: this.bcryptService.hashSync(SUPER_ADMIN_PASSWORD),
        type: UserType.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
  }

  async run() {
    await this.seedPermissions();
    await this.addSuperAdmin();
    await this.seedSuperAdminRoles();
  }
}

export default UserSeedService;
