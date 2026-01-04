import { QueryOptions, QuerySchema } from '../types';
import { cast } from '../utils';
import buildExpand from './build-expand';

export function buildFields<T>(
  fields: QueryOptions['fields'],
  expand: QueryOptions['expand'],
  schema?: QuerySchema<T>,
) {
  const include = buildExpand(expand, schema);

  return compose(typeof fields === 'string' ? cast(fields) : fields, include);

  function compose(
    fields: QueryOptions['fields'],
    include?: Record<string, any>,
  ) {
    if (!fields && !include) return {};
    if (!fields) return { include };

    const select = {} as Exclude<
      QueryOptions['fields'],
      string | string[] | undefined
    >;

    if (Array.isArray(fields) || typeof fields === 'string') {
      for (const key of typeof fields === 'string'
        ? fields.split(',')
        : fields) {
        const [name, value] = key.split(':');
        select[name] = value ? !!cast(value) : true;
      }
    }

    if (typeof fields === 'object' && fields) {
      Object.keys(fields).forEach((key) => {
        select[key] = !!(fields as any)[key];
      });
    }

    if (include) {
      for (const key in include) {
        if (key in select) {
          select[key] = select[key] ? include[key] : select[key];
        }
      }
    }

    return { select };
  }
}

export default buildFields;
