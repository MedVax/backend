import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { excludeProperties } from 'utils/object-util';

export const QueryFilter = createParamDecorator(
  (data: string | number, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const query = excludeProperties(request.query, [
      '_search',
      '_fields',
      '_sort',
      '_offset',
      '_limit',
      '_operator',
      '_expand',
      '_paginate',
      '_expand_on_filter',
    ]);

    if (query.id) {
      query._id = query.id;
      delete query.id;
    }
    return data ? query[data] : query;
  },
);
