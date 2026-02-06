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
import { excludeKeys } from 'utils/object-util';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
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
    console.error(`Permission Seeder Error: ${error?.message}`);
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
    console.error(`Admin Role Seeder Error: ${error?.message}`);
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

async function seedCategories() {
  console.log('Running Categories seeder');

  try {
    for (const category of categories) {
      const parentCategory = await prisma.category.upsert({
        where: {
          slug: category.slug,
        },
        update: {
          ...excludeKeys(category, ['subcategories', 'id']),
        },
        create: {
          ...excludeKeys(category, ['subcategories']),
        },
      });

      await prisma.category.createMany({
        data: category.subcategories.map((subcategory) => ({
          ...subcategory,
          parentId: parentCategory.id,
        })),
      });
    }
  } catch (error) {
    console.error(`Categories Seeder Error: ${error?.message}`);
  }
}

async function seedBrands() {
  console.log('Running Brands seeder');
  try {
    for (const brand of brands) {
      await prisma.brand.upsert({
        where: { id: brand.id }, // Assuming 'id' is available & unique
        update: { ...brand },
        create: { ...brand },
      });
    }
  } catch (error) {
    console.error(`Brands Seeder Error: ${error?.message}`);
  }
}

async function seedProducts() {
  console.log('Running Products seeder');
  try {
    for (const product of products) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: {
          name: product.name,
          description: product.description,
          price: product.price,
          currency: product.currency,
        },
        create: {
          id: product.id,
          sku: product.name.toLowerCase().replace(/ /g, '-'), // Assuming 'sku' property exists in product and is required by ProductCreateInput
          name: product.name,
          description: product.description,
          price: product.price,
          currency: product.currency,
          isActive: true,
          stockQuantity: product.stockQuantity,
          stockReserved: product.stockReserved,
          version: product.version,
          images: product.images,
          requiresPrescription: false,
          category: { connect: { id: '123e4567-e89b-12d3-a456-426614174000' } },
          brand: { connect: { id: '123e4567-e89b-12d3-a456-426614174000' } },
          dosages: product.dosages,
          packageSizes: product.packageSizes,
          howToUse: product.howToUse,
          ingredients: product.ingredients,
          pharmacyAdvise: product.pharmacyAdvise,
          specification: product.specification,
        },
      });
    }
  } catch (error) {
    console.error(`Products Seeder Error: ${error?.message}`);
  }
}

async function main() {
  await seedSuperAdminRoles();
  await seedPermissions();
  await seedSuperAdmin();
  await assignDefaultRoles();
  await seedCategories();
  await seedBrands();
  await seedProducts();
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

const categories = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000', // generate uuid using uuidv4
    name: 'Health & Wellness',
    description: 'Category 1 description',
    slug: 'health-wellness', // generate slug using slugify
    image: 'https://via.placeholder.com/150',
    subcategories: [
      {
        id: '123e4567-e89b-12d3-a456-426614174001', // generate uuid using uuidv4
        name: 'Vitamins & Supplements',
        description: 'Vitamins & Supplements description',
        slug: 'vitamins-supplements',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002', // generate uuid using uuidv4
        name: 'Herbal Supplements',
        description: 'Herbal Supplements description',
        slug: 'herbal-supplements',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174003', // generate uuid using uuidv4
        name: 'Minerals',
        description: 'Minerals description',
        slug: 'minerals',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174004', // generate uuid using uuidv4
        name: 'Probiotics',
        description: 'Probiotics description',
        slug: 'probiotics',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174005', // generate uuid using uuidv4
        name: 'Digestive Health',
        description: 'Digestive Health description',
        slug: 'digestive-health',
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174006', // generate uuid using uuidv4
    name: 'Mother & Child',
    description: 'Category 2 description',
    slug: 'mother-child', // generate slug using slugify
    image: 'https://via.placeholder.com/150',
    subcategories: [
      {
        id: '123e4567-e89b-12d3-a456-426614174007', // generate uuid using uuidv4
        name: 'Pregnancy',
        description: 'Pregnancy description',
        slug: 'pregnancy',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174008', // generate uuid using uuidv4
        name: 'Breastfeeding',
        description: 'Breastfeeding description',
        slug: 'breastfeeding',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174009', // generate uuid using uuidv4
        name: 'Baby Care',
        description: 'Baby Care description',
        slug: 'baby-care',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174010', // generate uuid using uuidv4
        name: 'Baby Food',
        description: 'Baby Food description',
        slug: 'baby-food',
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174011', // generate uuid using uuidv4
    name: 'Hair',
    description: 'Category 3 description',
    slug: 'hair',
    image: 'https://via.placeholder.com/150',
    subcategories: [
      {
        id: '123e4567-e89b-12d3-a456-426614174012', // generate uuid using uuidv4
        name: 'Hair Care',
        description: 'Hair Care description',
        slug: 'hair-care',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174013', // generate uuid using uuidv4
        name: 'Hair Loss',
        description: 'Hair Loss description',
        slug: 'hair-loss',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174014', // generate uuid using uuidv4
        name: 'Hair Growth',
        description: 'Hair Growth description',
        slug: 'hair-growth',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174015', // generate uuid using uuidv4
        name: 'Hair Color',
        description: 'Hair Color description',
        slug: 'hair-color',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174016', // generate uuid using uuidv4
        name: 'Hair Treatment',
        description: 'Hair Treatment description',
        slug: 'hair-treatment',
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174017', // generate uuid using uuidv4
    name: 'Skin',
    description: 'Category 4 description',
    slug: 'skin',
    image: 'https://via.placeholder.com/150',
    subcategories: [
      {
        id: '123e4567-e89b-12d3-a456-426614174018', // generate uuid using uuidv4
        name: 'Skin Care',
        description: 'Skin Care description',
        slug: 'skin-care',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174019', // generate uuid using uuidv4
        name: 'Acne',
        description: 'Acne description',
        slug: 'acne',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174020', // generate uuid using uuidv4
        name: 'Psoriasis',
        description: 'Psoriasis description',
        slug: 'psoriasis',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174021', // generate uuid using uuidv4
        name: 'Eczema',
        description: 'Eczema description',
        slug: 'eczema',
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174022', // generate uuid using uuidv4
    name: 'Mens',
    description: 'Category 6 description',
    slug: 'mens',
    image: 'https://via.placeholder.com/150',
    subcategories: [
      {
        id: '123e4567-e89b-12d3-a456-426614174023', // generate uuid using uuidv4
        name: 'Mens Care',
        description: 'Mens Care description',
        slug: 'mens-care',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174024', // generate uuid using uuidv4
        name: 'Mens Grooming',
        description: 'Mens Grooming description',
        slug: 'mens-grooming',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174025', // generate uuid using uuidv4
        name: 'Mens Hair Care',
        description: 'Mens Hair Care description',
        slug: 'mens-hair-care',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174026', // generate uuid using uuidv4
        name: 'Mens Skin Care',
        description: 'Mens Skin Care description',
        slug: 'mens-skin-care',
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174027', // generate uuid using uuidv4
        name: 'Mens Bath & Body',
        description: 'Mens Bath & Body description',
        slug: 'mens-bath-body',
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
];

const brands = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000', // generate uuid using uuidv4
    name: 'Pfizer',
    description: 'Pfizer description',
    logo: 'https://via.placeholder.com/150',
    website: 'https://www.pfizer.com',
    isActive: true,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001', // generate uuid using uuidv4
    name: 'GlaxoSmithKline (GSK)',
    description: 'GlaxoSmithKline (GSK) description',
    logo: 'https://via.placeholder.com/150',
    website: 'https://www.gsk.com',
    isActive: true,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174002', // generate uuid using uuidv4
    name: 'Novartis',
    description: 'Novartis description',
    logo: 'https://via.placeholder.com/150',
    website: 'https://www.novartis.com',
    isActive: true,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174003', // generate uuid using uuidv4
    name: 'Roche',
    description: 'Roche description',
    logo: 'https://via.placeholder.com/150',
    website: 'https://www.roche.com',
    isActive: true,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174004', // generate uuid using uuidv4
    name: 'Merck',
    description: 'Merck description',
    logo: 'https://via.placeholder.com/150',
    website: 'https://www.merck.com',
    isActive: true,
  },
];

const products = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000', // generate uuid using uuidv4
    name: 'Paracetamol 500mg',
    description: 'Paracetamol 500mg description',
    price: 10000,
    currency: 'NGN',
    brandId: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    isActive: true,
    stockQuantity: 100,
    stockReserved: 0,
    version: 1,
    images: [
      'https://fusiondesk-staging.nyc3.cdn.digitaloceanspaces.com/medication.jpg',
    ],
    dosages: ['500mg'],
    packageSizes: ['10 tablets'],
    howToUse: 'Take one tablet daily with water after meals',
    ingredients: ['Paracetamol'],
    pharmacyAdvise: 'Store in a cool, dry place. Keep away from children.',
    specification: 'Paracetamol 500mg specification',
    catgoryId: '123e4567-e89b-12d3-a456-426614174000',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001', // generate uuid using uuidv4
    name: 'Mason L-Arginine 500mg Capsules x 60',
    description: 'Mason L-Arginine 500mg Capsules x 60 description',
    price: 20000,
    currency: 'NGN',
    brandId: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    isActive: true,
    stockQuantity: 100,
    stockReserved: 0,
    version: 1,
    images: [
      'https://fusiondesk-staging.nyc3.cdn.digitaloceanspaces.com/medication.jpg',
    ],
    dosages: ['500mg'],
    packageSizes: ['10 tablets'],
    howToUse: 'Take one tablet daily with water after meals',
    ingredients: ['Paracetamol'],
    pharmacyAdvise: 'Store in a cool, dry place. Keep away from children.',
    specification: 'Mason L-Arginine 500mg Capsules x 60 specification',
    catgoryId: '123e4567-e89b-12d3-a456-426614174000',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174002', // generate uuid using uuidv4
    name: 'Vitamin C 1000mg',
    description: 'Vitamin C 1000mg description',
    price: 30000,
    currency: 'NGN',
    brandId: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    isActive: true,
    stockQuantity: 100,
    stockReserved: 0,
    version: 1,
    images: [
      'https://fusiondesk-staging.nyc3.cdn.digitaloceanspaces.com/medication.jpg',
    ],
    dosages: ['1000mg'],
    packageSizes: ['10 tablets'],
    howToUse: 'Take one tablet daily with water after meals',
    ingredients: ['Vitamin C'],
    pharmacyAdvise: 'Store in a cool, dry place. Keep away from children.',
    specification: 'Vitamin C 1000mg specification',
    catgoryId: '123e4567-e89b-12d3-a456-426614174000',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174003', // generate uuid using uuidv4
    name: 'Vitamin D 1000mg',
    description: 'Vitamin D 1000mg description',
    price: 40000,
    currency: 'NGN',
    brandId: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    isActive: true,
    stockQuantity: 100,
    stockReserved: 0,
    version: 1,
    images: [
      'https://fusiondesk-staging.nyc3.cdn.digitaloceanspaces.com/medication.jpg',
    ],
    dosages: ['1000mg'],
    packageSizes: ['10 tablets'],
    howToUse: 'Take one tablet daily with water after meals',
    ingredients: ['Vitamin D'],
    pharmacyAdvise: 'Store in a cool, dry place. Keep away from children.',
    specification: 'Vitamin D 1000mg specification',
    catgoryId: '123e4567-e89b-12d3-a456-426614174000',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174004', // generate uuid using uuidv4
    name: 'Vitamin B12 1000mg',
    description: 'Vitamin B12 1000mg description',
    price: 50000,
    currency: 'NGN',
    brandId: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    isActive: true,
    stockQuantity: 100,
    stockReserved: 0,
    version: 1,
    images: [
      'https://fusiondesk-staging.nyc3.cdn.digitaloceanspaces.com/medication.jpg',
    ],
    dosages: ['1000mg'],
    packageSizes: ['10 tablets'],
    howToUse: 'Take one tablet daily with water after meals',
    ingredients: ['Vitamin B12'],
    pharmacyAdvise: 'Store in a cool, dry place. Keep away from children.',
    specification: 'Vitamin B12 1000mg specification',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174005', // generate uuid using uuidv4
    name: 'Vitamin B6 1000mg',
    description: 'Vitamin B6 1000mg description',
    price: 60000,
    currency: 'NGN',
    brandId: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    isActive: true,
    stockQuantity: 100,
    stockReserved: 0,
    version: 1,
    images: [
      'https://fusiondesk-staging.nyc3.cdn.digitaloceanspaces.com/medication.jpg',
    ],
    dosages: ['1000mg'],
    packageSizes: ['10 tablets'],
    howToUse: 'Take one tablet daily with water after meals',
    ingredients: ['Vitamin B6'],
    pharmacyAdvise: 'Store in a cool, dry place. Keep away from children.',
    specification: 'Vitamin B6 1000mg specification',
    requiresPrescription: false,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174006', // generate uuid using uuidv4
    name: 'Vitamin B12 1000mg',
    description: 'Vitamin B12 1000mg description',
    price: 70000,
    currency: 'NGN',
    brandId: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    isActive: true,
    stockQuantity: 100,
    stockReserved: 0,
    version: 1,
    images: [
      'https://fusiondesk-staging.nyc3.cdn.digitaloceanspaces.com/medication.jpg',
    ],
    dosages: ['1000mg'],
    packageSizes: ['10 tablets'],
    howToUse: 'Take one tablet daily with water after meals',
    ingredients: ['Vitamin B12'],
    pharmacyAdvise: 'Store in a cool, dry place. Keep away from children.',
    specification: 'Vitamin B12 1000mg specification',
    requiresPrescription: false,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174007', // generate uuid using uuidv4
    name: 'Vitamin B12 1000mg',
    description: 'Vitamin B12 1000mg description',
    price: 80000,
    currency: 'NGN',
    brandId: '123e4567-e89b-12d3-a456-426614174000',
    categoryId: '123e4567-e89b-12d3-a456-426614174000',
    isActive: true,
    stockQuantity: 100,
    stockReserved: 0,
    version: 1,
    images: [
      'https://fusiondesk-staging.nyc3.cdn.digitaloceanspaces.com/medication.jpg',
    ],
    dosages: ['1000mg'],
    packageSizes: ['10 tablets'],
    howToUse: 'Take one tablet daily with water after meals',
    ingredients: ['Vitamin B12'],
    pharmacyAdvise: 'Store in a cool, dry place. Keep away from children.',
    specification: 'Vitamin B12 1000mg specification',
    requiresPrescription: false,
  },
];
