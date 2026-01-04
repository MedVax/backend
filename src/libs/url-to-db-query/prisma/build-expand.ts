import { QueryOptions, QuerySchema } from '../types';
import { cast } from '../utils';

export function buildExpand<T>(
  expand: QueryOptions['expand'],
  schema?: QuerySchema<T>,
) {
  return compose(typeof expand === 'string' ? cast(expand) : expand, schema);

  function compose<T>(
    expand: Exclude<QueryOptions['expand'], string>,
    schema?: QuerySchema<T>,
    parentKeys = [] as string[],
  ): Record<string, any> | undefined {
    if (
      schema &&
      !!Object.keys(schema).length &&
      (Array.isArray(expand) ? !!expand.length : expand)
    ) {
      const expansion = {} as Record<string, any>;

      for (const key in schema) {
        const config = schema[key];
        if (
          config &&
          config.expand &&
          (Array.isArray(expand)
            ? expand.includes([...parentKeys, key].join('.')) ||
              (config.schema &&
                expand.findIndex((expandKey) =>
                  expandKey.startsWith(
                    [...parentKeys, key].join('.').concat('.'),
                  ),
                ) > -1)
            : expand)
        ) {
          if (config.schema) {
            const nestedExpansion = compose(expand, config.schema, [
              ...parentKeys,
              key,
            ]);

            if (nestedExpansion) {
              expansion[key] = { select: nestedExpansion };
            }
          } else {
            expansion[key] = true;
          }
        }
      }

      return expansion;
    }

    return undefined;
  }
}

export default buildExpand;
