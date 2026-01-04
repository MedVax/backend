import { createBuilder } from 'libs/url-to-db-query/prisma';

const userUrlToPrismaQueryBuilder = createBuilder({
  schema: {
    email: { searchable: true },
    firstName: { searchable: true },
    lastName: { searchable: true },
    organization: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        name: { expand: true },
        slug: { expand: true },
      },
    },
  },
});

export default userUrlToPrismaQueryBuilder;
