import { createBuilder } from 'libs/url-to-db-query/prisma';

const roleUrlToPrismaQueryBuilder = createBuilder({
  schema: {
    name: { searchable: true },
    description: { searchable: true },
    organization: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        name: { expand: true },
        slug: { expand: true },
      },
    },
    users: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        userId: { expand: true },
        roleId: { expand: true },
      },
    },
  },
});

export default roleUrlToPrismaQueryBuilder;
