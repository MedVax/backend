import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserStatus,
  UserType,
} from '../src/generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { PermissionEnum } from 'modules/permissions/enums/permissions.enum';

import {
  DATABASE_URL,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
} from 'constants/env.constant';
import { formatPermission } from 'modules/permissions/helpers/permissions.helper';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
  }),
});

async function assignDefaultRoles() {
  const ALL_ACCESS_PERMISSION = await prisma.permission.findUnique({
    where: { value: PermissionEnum.ALL_ACCESS },
  });

  if (!ALL_ACCESS_PERMISSION) return;

  const orgAdminUsers = await prisma.user.findMany({
    where: { type: UserType.ADMIN },
    include: { userRoles: { include: { role: true } } },
  });

  for (const user of orgAdminUsers) {
    const hasRoleInOrg = user.userRoles.some(
      (role) => role.role.id === user.userRoles[0].role.id,
    );

    if (!hasRoleInOrg) {
      const roleName = `Admin`;

      const role = await prisma.role.upsert({
        where: {
          name: roleName,
        },
        update: {},
        create: {
          name: roleName,
          description: 'Default Role with all access',
          permissions: {
            create: {
              permissionId: ALL_ACCESS_PERMISSION.id,
            },
          },
        },
      });

      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });

      console.log(
        `Created & assigned default ORG_ADMIN role to user ${user.email}`,
      );
    }
  }

  const globalAdmins = await prisma.user.findMany({
    where: {
      type: { in: [UserType.ADMIN, UserType.SUPER_ADMIN] },
    },
    include: { userRoles: { include: { role: true } } },
  });

  const globalRolesMap = {
    [UserType.ADMIN]: null,
    [UserType.SUPER_ADMIN]: null,
  };

  for (const user of globalAdmins) {
    const hasAnyRole = user.userRoles.length > 0;
    if (hasAnyRole) {
      continue;
    }

    const roleName = 'Admin';

    if (!globalRolesMap[user.type]) {
      let role = await prisma.role.findFirst({
        where: {
          name: roleName,
        },
      });

      if (!role) {
        role = await prisma.role.create({
          data: {
            name: roleName,
            description: 'Default Role with all access',
            permissions: {
              create: {
                permissionId: ALL_ACCESS_PERMISSION.id,
              },
            },
          },
        });

        console.log(`Created new global role "${roleName}"`);
      }

      globalRolesMap[user.type] = role;
    }

    // Assign the existing role to the user
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: globalRolesMap[user.type]?.id,
      },
    });

    console.log(
      `Assigned default GLOBAL role "${roleName}" to user "${user.email}"`,
    );
  }

  console.log('Assigning default roles completed!');
}

async function seedPermissions() {
  console.log('Running Permission seeder');

  const permissions = Object.values(PermissionEnum).map(formatPermission);

  try {
    await prisma.permission.createMany({
      data: permissions,
      skipDuplicates: true,
    });

    console.log('Seeding completed!');
  } catch (error) {
    console.error(`Permission Seeder Error`);
  }
}

async function seedSuperAdminRoles() {
  console.log('Checking if seeding is necessary...');
  const superAdminRoleName = 'Super Admin';

  const adminRoleExists = await prisma.role.findFirst({
    where: {
      name: superAdminRoleName,
    },
  });

  if (adminRoleExists) {
    console.log('Super Admin Roles already exist. Skipping seeding.');
    return;
  }

  console.log('Running Super Amin Role seeder');

  const adminRoles = [
    {
      name: superAdminRoleName,
      description: 'Super Admin with full access',
      organizationId: null,
    },
  ];

  const allSuperAminUsers = await prisma.user.findMany({
    where: {
      type: UserType.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  if (allSuperAminUsers.length === 0) {
    console.log('No super admin users found. Skipping seeding.');
    return;
  }

  try {
    const roles = await Promise.all(
      adminRoles.map((role) =>
        prisma.role.upsert({
          where: {
            name: role.name,
          },
          update: {},
          create: role,
        }),
      ),
    );

    const allAccessPermission = await prisma.permission.findFirst({
      where: {
        value: PermissionEnum.ALL_ACCESS,
      },
    });

    if (!allAccessPermission) {
      console.error('Permission ALL_ACCESS not found');
      return;
    }

    await prisma.rolePermission.createMany({
      data: [
        ...roles.map((role) => ({
          roleId: role.id,
          permissionId: allAccessPermission.id,
        })),
      ],
    });

    for (const user of allSuperAminUsers) {
      await prisma.userRole.createMany({
        data: roles.map((role) => ({
          userId: user.id,
          roleId: role.id,
        })),
      });
    }
  } catch (error) {
    console.error(`Admin Role Seeder Error`);
  }
}

async function seedSuperAdmin() {
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      email: SUPER_ADMIN_EMAIL,
      firstName: 'super',
      lastName: 'admin',
      password: bcrypt.hashSync(SUPER_ADMIN_PASSWORD, bcrypt.genSaltSync(10)),
      type: UserType.SUPER_ADMIN,
    },
  });
}

async function main() {
  await seedSuperAdminRoles();
  await seedPermissions();
  await seedSuperAdmin();
  await assignDefaultRoles();
}

main()
  .then(async () => {
    console.log('Seed completed successfully');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    console.log('Seed failed');
    await prisma.$disconnect();
    process.exit(1);
  });
