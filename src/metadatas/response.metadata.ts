import { Reflector } from '@nestjs/core';

export const Response = Reflector.createDecorator<IResponseOptions>();

export type IResponseOptions =
  | IResponseObjectOptions
  | IResponseCallbackOptions;

export interface IResponseObjectOptions {
  [x: string]: any | ((data: any, options?: IResponseObjectOptions) => string);
  message?: string | ((data: any, options?: IResponseObjectOptions) => string);
  status?: number | ((data: any, options?: IResponseObjectOptions) => number);
  code?: string | ((data: any, options?: IResponseObjectOptions) => string);
  data?: any | ((data: any, options?: IResponseObjectOptions) => any);
  filtered?: number | ((data: any, options?: IResponseObjectOptions) => number);
  pages?: number | ((data: any, options?: IResponseObjectOptions) => number);
  size?: number | ((data: any, options?: IResponseObjectOptions) => number);
  total?: number | ((data: any, options?: IResponseObjectOptions) => number);
}

export interface IResponseCallbackOptions {
  (data: any, options?: IResponseOptions): IResponseOptions;
}
