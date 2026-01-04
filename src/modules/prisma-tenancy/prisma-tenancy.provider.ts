import { Prisma, UserType } from 'generated/prisma/client';
import { QueryFilter, QueryOptions } from 'libs/url-to-db-query';
import { createBuilder } from 'libs/url-to-db-query/prisma';
import roleUrlToPrismaQueryBuilder from 'modules/roles/role-url-to-prisma-query-builder';
import userUrlToPrismaQueryBuilder from 'modules/user/user-url-to-prisma-query-builder';
import { ClsService } from 'nestjs-cls';
import { PaginatedResult } from 'src/classes/paginated-result';

import { DatabaseModule } from 'src/database/database.module';
import { PrismaService } from 'src/database/prisma.service';
import { getPageCount } from 'types/index.types';
import { excludeProperties } from 'utils/object-util';

const useFactory = (prisma: PrismaService, store: ClsService) => {
  return prisma.$extends({
    name: 'Tenancy extension',
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`;
          },
        },
      },
    },
    model: {
      $allModels: {
        async countWithUrlQuery<M, T>(
          this: M,
          filter?: QueryFilter<T>,
          options?: QueryOptions<T>,
        ): Promise<number> {
          const context = Prisma.getExtensionContext(this);

          if (!context.$name) return 0;

          const buildQuery = MODEL_QUERY_BUILDERS[context.$name];
          const query = buildQuery(filter, options);

          return await (context as any).count(query);
        },
        async findManyWithUrlQuery<M, T>(
          this: M,
          filter?: QueryFilter<T>,
          options?: QueryOptions<T>,
        ): Promise<T[] | PaginatedResult<T>> {
          const context = Prisma.getExtensionContext(this);

          if (!context.$name) return [];

          const buildQuery = MODEL_QUERY_BUILDERS[context.$name];
          const query = buildQuery(filter, options);

          const data = await (context as any).findMany(query);

          if (query.skip >= 0 && query.take >= 0) {
            const total = await (context as any).count();
            const filtered = await (context as any).count(
              excludeProperties(query, [
                'include',
                'select',
                'take',
                'skip',
                'cursor',
              ]),
            );

            return new PaginatedResult({
              data,
              filtered,
              pages: Math.ceil(filtered / query.take),
              size: data.length,
              total,
            });
          }

          return data;
        },
        async findFirstWithUrlQuery<M, T>(
          this: M,
          filter?: QueryFilter<T>,
          options?: QueryOptions<T>,
        ): Promise<T> {
          const context = Prisma.getExtensionContext(this);

          if (!context.$name) return null as T;

          const buildQuery = MODEL_QUERY_BUILDERS[context.$name];
          const query = buildQuery(filter, options);

          const excludeQuery = excludeProperties(query, ['take', 'skip']);

          return await (context as any).findFirst(excludeQuery);
        },

        async paginate<T>(
          this: T,
          args: Prisma.Args<T, 'findMany'>,
        ): Promise<any> {
          // Get the current model at runtime
          const context = Prisma.getExtensionContext(this);
          const result = await (context as any).findMany({
            ...args,
          });

          if (args?.take < 0 || args?.skip < 0) {
            return result;
          }

          const totalRecords = await (context as any).count({
            where: args?.where,
          });

          return {
            data: result,
            skip: args?.skip,
            take: args?.take,
            totalRecords,
            pages: getPageCount(totalRecords, args?.take) || 0,
          };
        },
      },
    },
    query: {
      user: {},
      async $allOperations({ args, query, model }: any) {
        const tenantId = store.get('TENANT_ID');
        const userType = store.get('USER_TYPE');

        if (
          !(
            [UserType.SUPER_ADMIN, UserType.ADMIN].includes(userType) ||
            [
              'Currency',
              'CurrencyExchange',
              'PaymentProvider',
              'Organization',
            ].includes(model)
          )
        ) {
          if (tenantId) {
            args.where = { ...args.where, organizationId: tenantId };
          }
        }

        // const start = performance.now();
        const result = await query(args);
        // const end = performance.now();
        // const time = end - start;
        // console.log({ args, time: time / 1000 + 's' });

        return result;
      },
    },
  });
};

export type ExtendedTenantClient = ReturnType<typeof useFactory>;

export const TENANCY_CLIENT_TOKEN = Symbol('TENANCY_CLIENT_TOKEN');

export const PrismaTenancyClientProvider = {
  provide: TENANCY_CLIENT_TOKEN,
  imports: [DatabaseModule],
  inject: [PrismaService, ClsService],
  useFactory,
};

const MODEL_QUERY_BUILDERS = {
  Role: roleUrlToPrismaQueryBuilder,
  User: userUrlToPrismaQueryBuilder,
} as {
  // [K in Exclude<
  //   keyof Exclude<
  //     Parameters<typeof PrismaClient.prototype.$extends>[0],
  //     // eslint-disable-next-line @typescript-eslint/ban-types
  //     Function
  //   >['model'],
  //   '$allModels'
  // >]: ReturnType<typeof createBuilder>;
  [K in Prisma.ModelName]: ReturnType<typeof createBuilder>;
};
