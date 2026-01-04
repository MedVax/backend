import { PrismaClient, Prisma } from 'generated/prisma/client';
import {
  createBuilder,
  QueryBuilderCreateOptions,
  QueryFilter,
  QueryOptions,
} from 'libs/url-to-db-query/prisma';
import { PaginatedResult } from './paginated-result';

function createExtension<
  T,
  WhereInput = any,
  Select = any,
  Include = any,
  OrderByInput = any,
>(modelName: any, options: CreateExtensionOptions<T> = {}) {
  const { ...builderOptions } = options;

  const buildQuery = createBuilder<
    T,
    WhereInput,
    Select,
    Include,
    OrderByInput
  >(builderOptions);

  return Prisma.defineExtension((client) => {
    return client.$extends({
      name: `prisma-extension-url-to-db-query`,
      model: {
        $allModels: {
          async countWithUrlQuery<M>(
            this: M,
            filter: QueryFilter<T>,
            options: QueryOptions<T>,
          ): Promise<number> {
            const context = Prisma.getExtensionContext(this);
            const query = buildQuery(filter, options);
            return await (context as any).count(query);
          },
          async findManyWithUrlQuery<M>(
            this: M,
            filter: QueryFilter<T>,
            options: QueryOptions<T>,
          ): Promise<T[] | PaginatedResult<T>> {
            const context = Prisma.getExtensionContext(this);
            const query = buildQuery(filter, options);

            const data = await (context as any).findMany(query);

            if (
              query.skip &&
              query.take &&
              query.skip >= 0 &&
              query.take >= 0
            ) {
              const total = await (context as any).count();
              const filtered = await (context as any).count(query);

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
          async findFirstWithUrlQuery<M>(
            this: M,
            filter: QueryFilter<T>,
            options: QueryOptions<T>,
          ): Promise<number> {
            const context = Prisma.getExtensionContext(this);
            const query = buildQuery(filter, options);
            return await (context as any).findFirst(query);
          },
        },
      },
    });
  });
}

export default createExtension;

export type CreateExtensionOptions<T> = QueryBuilderCreateOptions<T>;

// export type ModelNames = keyof Exclude<
//   Parameters<typeof PrismaClient.prototype.$extends>[0],
//   Function
// >['model'];

// export type ModelNames = keyof typeof Prisma.ModelName;

export type ModelNames_ = keyof Omit<
  PrismaClient,
  | symbol
  | '$on'
  | '$connect'
  | '$disconnect'
  | '$use'
  | '$executeRaw'
  | '$executeRawUnsafe'
  | '$queryRaw'
  | '$queryRawUnsafe'
  | '$transaction'
  | '$extends'
  | '$runCommandRaw'
>;
