import { HttpException as NestHttpException } from '@nestjs/common';

export class HttpException extends NestHttpException {
  code: string | number;
  description: string;
  timestamp: number;
  errors: HttpExceptionError[];

  constructor(message: string, status: number, options?: HttpExceptionOptions) {
    super(message, status, options);
    this.cause = this?.cause || this;
    this.code = options?.code || 'server';
    this.description = options?.description || '';
    this.errors = options?.errors || [];
    this.timestamp = options?.timestamp || Date.now();
    this.name = this.constructor.name;
  }
}

export interface HttpExceptionOptions {
  timestamp?: number;
  cause?: Error;
  code?: string | number;
  description?: string;
  errors?: HttpExceptionError[];
}

export interface HttpExceptionError {
  message: string;
  description: string;
}
