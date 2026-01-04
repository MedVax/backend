import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { IS_DEVELOPMENT } from 'constants/env.constant';
import { HttpException } from 'exceptions/http-exception';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    if (IS_DEVELOPMENT) {
      this.logger.error(
        `<${exception.name}> ${exception.message || exception.message} \n${
          exception.stack
        }`,
      );
    }

    const errorResponse = {
      status: status,
      timestamp: new Date().toISOString(),
      message: exception.message,
      name: exception.name,
      description: exception?.description,
      errors: exception?.errors,
    };

    response.status(status).json(errorResponse);
  }
}
