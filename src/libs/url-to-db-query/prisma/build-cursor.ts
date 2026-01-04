import buildFilter from './build-filter';
import { QueryOptions, QuerySchema } from '../types';
import { cast } from '../utils';

export function buildCursor<T>(
  cursor: QueryOptions['cursor'],
  schema?: QuerySchema<T>,
) {
  return compose(typeof cursor === 'string' ? cast(cursor) : cursor, schema);

  function compose<T>(
    cursor: Exclude<QueryOptions['cursor'], string>,
    schema?: QuerySchema<T>,
  ) {
    if (!cursor) return undefined;

    return buildFilter(
      typeof cursor === 'string' ? { id: cursor } : cursor,
      schema,
    );
  }
}

export default buildCursor;
