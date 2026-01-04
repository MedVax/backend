import { QuerySchema } from '../types';

export function buildSearch<T>(search?: string, schema?: QuerySchema<T>) {
  const result = compose(search, schema);

  if (!result.length) return undefined;

  return { OR: result };

  function compose<T>(search?: string, schema?: QuerySchema<T>) {
    const orQuery = [] as any[];

    if (search && schema) {
      for (const key in schema) {
        const config = schema[key];
        const configType = config?.type ?? 'scalar';

        if (config?.searchable) {
          if (
            [
              'relation',
              'relation_list',
              'composite',
              'composite_list',
            ].includes(configType)
          ) {
            const nestedOrQuery = buildSearch(search, config.schema);

            if (nestedOrQuery) {
              orQuery.push({
                [key]: ['relation_list', 'composite_list'].includes(configType)
                  ? { some: nestedOrQuery }
                  : nestedOrQuery,
              });
            }
          } else if (config.type === 'scalar_list') {
            orQuery.push({
              [key]: {
                hasSome: [
                  search,
                  search?.toLowerCase(),
                  ...(search?.split(' ')?.reduce((acc, token) => {
                    acc.push(token, token.toLowerCase());
                    return acc;
                  }, [] as string[]) || []),
                ],
              },
            });
          } else {
            orQuery.push({
              OR: [
                { [key]: { contains: search, mode: 'insensitive' } },
                ...(search?.split(' ')?.map((token) => ({
                  [key]: { contains: token, mode: 'insensitive' },
                })) || []),
              ],
            });
          }
        }
      }
    }

    return orQuery;
  }
}

export default buildSearch;
