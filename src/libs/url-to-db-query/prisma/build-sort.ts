import { QueryOptions, QuerySchema, SortObject } from '../types';
import { cast } from '../utils';

export function buildSort<T>(
  sort: QueryOptions<T>['sort'],
  schema?: QuerySchema<T>,
) {
  // @TODO nested sort
  return compose(typeof sort === 'string' ? cast(sort) : sort, schema);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function compose(sort: QueryOptions<T>['sort'], schema?: QuerySchema<T>) {
    if (!sort) return undefined;

    const sortMap = { asc: 'asc', desc: 'desc', '1': 'asc', '-1': 'desc' };
    const _sort = {} as SortObject<T>;

    if (typeof sort === 'string') {
      for (const key of sort.split(',')) {
        const [name, value] = key.split(':');
        _sort[name] = sortMap[value] || 'asc';
      }
    }

    if (typeof sort === 'object') {
      const arrSort = Array.isArray(sort) ? sort : [sort];
      for (const arrSortItem of arrSort) {
        for (const key in arrSortItem) {
          const value = arrSortItem[key];
          _sort[key] = sortMap[value as string] ?? value ?? 'asc';
        }
      }
    }

    return _sort;
  }
}

export default buildSort;
