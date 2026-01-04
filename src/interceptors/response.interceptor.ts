import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { Response as ResponseMetadata } from 'metadatas/response.metadata';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const classMetadata = this.reflector.get(
      ResponseMetadata,
      context.getClass(),
    );

    const methodMetadata = this.reflector.getAllAndOverride(ResponseMetadata, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((data) => {
        if (!methodMetadata) return data;
        let response = {} as any;

        if (
          (data ?? false) &&
          typeof data === 'object' &&
          ['data', 'message', 'status', 'code'].every((key) => key in data)
        ) {
          response = Object.assign(response, data);
        }

        const resolvedMethodMetadata: any =
          typeof methodMetadata === 'function'
            ? methodMetadata(data, classMetadata)
            : methodMetadata;

        if (resolvedMethodMetadata) {
          for (const key in resolvedMethodMetadata) {
            response[key] =
              typeof resolvedMethodMetadata[key] === 'function'
                ? resolvedMethodMetadata[key](data, classMetadata)
                : resolvedMethodMetadata[key];
          }
        }

        response.data ??= data;

        return plainToInstance(Response, {
          ...response,
          message: response.message ?? 'Successfull!',
          code: response.code ?? 'info',
          status: response.status ?? 200,
        });
      }),
    );
  }
}

class Response {
  message?: string;
  status?: number;
  code?: string;
  data?: any;
}
