import { createBuilder } from 'libs/url-to-db-query/prisma';

const productUrlToPrismaQueryBuilder = createBuilder({
  schema: {
    name: { searchable: true },
    description: { searchable: true },
    brand: { searchable: true },
    price: { searchable: true },
    currency: { searchable: true },
    requiresPrescription: { searchable: true },
    productType: { searchable: true },
    dosages: { searchable: true },
    packageSizes: { searchable: true },
    isActive: { searchable: true },
    stockQuantity: { searchable: true },
    stockReserved: { searchable: true },
    version: { searchable: true },
    createdAt: { searchable: true },
    updatedAt: { searchable: true },
    category: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
      },
    },
  },
});

export default productUrlToPrismaQueryBuilder;
