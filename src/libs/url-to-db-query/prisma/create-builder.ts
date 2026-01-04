import buildCursor from './build-cursor';
// import buildExpand from './build-expand';
import buildFields from './build-fields';
import buildFilter from './build-filter';
import buildSearch from './build-search';
import buildSort from './build-sort';
import { QueryFilter, QueryOptions, QuerySchema } from '../types';

export function createBuilder<
  T = any,
  WhereInput = any,
  Select = any,
  Include = any,
  OrderByInput = any,
>(options?: QueryBuilderCreateOptions<T>) {
  const configOptions = options || {};

  return function buildQuery(filter: QueryFilter<T>, options: QueryOptions) {
    const queryOptions = Object.assign({}, options, {
      paginate: options?.paginate ?? true,
    });

    const skip = queryOptions.paginate
      ? queryOptions.paginate === 'cursor'
        ? queryOptions.cursor
          ? 1
          : 0
        : Number(queryOptions.offset || 0)
      : undefined;

    const take = queryOptions.paginate
      ? Number(queryOptions.limit || 20)
      : undefined;

    const cursor = buildCursor<T>(
      typeof configOptions?.cursor === 'function'
        ? configOptions?.cursor(queryOptions.cursor)
        : (queryOptions.cursor ?? configOptions?.cursor),
      configOptions.schema,
    );

    const orderBy = buildSort(
      typeof configOptions?.sort === 'function'
        ? configOptions?.sort(queryOptions.sort)
        : (queryOptions.sort ?? configOptions?.sort),
      configOptions.schema,
    ) as OrderByInput;

    const whereFilter = buildFilter<T>(
      Object.assign({}, configOptions.filter, filter),
      configOptions.schema,
    ) as WhereInput;

    const searchFilter = buildSearch<T>(
      queryOptions.search,
      configOptions.schema,
    ) as WhereInput;

    /**
     * Composition of both filter and search filter
     */
    const where = Object.assign(
      {},
      whereFilter,
      searchFilter,
      whereFilter['OR']?.length
        ? { OR: [].concat(whereFilter['OR'], searchFilter?.['OR'] || []) }
        : searchFilter?.['OR']?.length
          ? {
              OR: searchFilter?.['OR'],
            }
          : {},
    ) as WhereInput;

    const resolvedExpand =
      typeof configOptions?.expand === 'function'
        ? configOptions?.expand(queryOptions.expand)
        : (queryOptions.expand ?? configOptions?.expand);

    // const include = buildExpand(
    //   resolvedExpand,
    //   configOptions.schema,
    // ) as Include;

    const { select, include } = buildFields(
      typeof configOptions?.fields === 'function'
        ? configOptions?.fields(queryOptions.fields)
        : (queryOptions.fields ?? configOptions?.fields),
      resolvedExpand,
      configOptions.schema,
    ) as { select?: Select; include?: Include };

    return {
      where,
      select,
      include,
      orderBy,
      skip,
      take,
      cursor,
    };
  };
}

export default createBuilder;

export interface QueryBuilderCreateOptions<T> {
  schema?: QuerySchema<T>;
  filter?: QueryFilter<T>;
  expand?:
    | QueryOptions['expand']
    | ((expand: QueryOptions['expand']) => QueryOptions['expand']);
  sort?:
    | QueryOptions['sort']
    | ((sort: QueryOptions['sort']) => QueryOptions['sort']);
  paginate?:
    | QueryOptions['paginate']
    | ((paginate: QueryOptions['paginate']) => QueryOptions['paginate']);
  offset?:
    | QueryOptions['offset']
    | ((offset: QueryOptions['offset']) => QueryOptions['offset']);
  limit?:
    | QueryOptions['limit']
    | ((limit: QueryOptions['limit']) => QueryOptions['limit']);
  fields?:
    | QueryOptions['fields']
    | ((fields: QueryOptions['fields']) => QueryOptions['fields']);
  cursor?: (cursor: QueryOptions['cursor']) => QueryOptions['cursor'];
}
