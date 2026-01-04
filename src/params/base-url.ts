import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const BaseUrl = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const baseUrl = request.protocol + '://' + request.get('host');
    //   request.protocol + '://' + request.get('host') + request.originalUrl;
    return baseUrl;
  },
);
