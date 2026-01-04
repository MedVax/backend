import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { cast } from 'utils/string-util';

export const QueryOptions = createParamDecorator(
  (data: string | number, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const {
      _search,
      _fields,
      _sort,
      _offset,
      _limit,
      _operator,
      _expand,
      _paginate,
      _expand_on_filter,
    } = request.query;
    const query = {
      search: _search,
      offset: Number(_offset) || 0,
      limit: Number(_limit) || 10,
      fields: _fields,
      sort: _sort,
      expand: cast(_expand),
      paginate: cast(_paginate),
      operator: _operator,
      expand_on_filter: _expand_on_filter,
    };
    return data ? query[data] : query;
  },
);
