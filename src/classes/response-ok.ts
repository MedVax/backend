import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class ResponseOk<T> {
  @ApiProperty({ type: () => String, required: false })
  message?: string;

  @ApiProperty({ type: () => Number, required: false })
  status?: number;

  @ApiProperty({ type: () => String, required: false })
  code?: string;

  // data property is handled dynamically by ApiResponseOk decorator
  // @ApiProperty({ type: () => Object, isArray: true, required: false })
  // @ApiHideProperty()
  data?: T[];

  @ApiProperty({ type: () => Number, required: false })
  filtered?: number;

  @ApiProperty({ type: () => Number, required: false })
  pages?: number;

  @ApiProperty({ type: () => Number, required: false })
  size?: number;

  @ApiProperty({ type: () => Number, required: false })
  total?: number;

  // @ApiProperty()
  // accessToken?: string;

  constructor(options?: ResponseOkOptions) {
    this.message = options?.message;
    this.status = options?.status;
    this.code = options?.code;
    this.data = options?.data;
    this.filtered = options?.filtered;
    this.pages = options?.pages;
    this.size = options?.size;
    this.total = options?.total;
    // this.accessToken = options?.accessToken;
  }

  static builder<T>() {
    return new ResponseOkBuilder<T>();
  }
}

export class ResponseOkBuilder<T> {
  private response = new ResponseOk<T>();

  message(message: string): ResponseOkBuilder<T> {
    this.response.message = message;
    return this;
  }

  status(status: number): ResponseOkBuilder<T> {
    this.response.status = status;
    return this;
  }

  code(code: string): ResponseOkBuilder<T> {
    this.response.code = code;
    return this;
  }

  data(data: any): ResponseOkBuilder<T> {
    this.response.data = data;
    return this;
  }

  filtered(filtered: number): ResponseOkBuilder<T> {
    this.response.filtered = filtered;
    return this;
  }

  pages(pages: number): ResponseOkBuilder<T> {
    this.response.pages = pages;
    return this;
  }

  size(size: number): ResponseOkBuilder<T> {
    this.response.size = size;
    return this;
  }

  total(total: number): ResponseOkBuilder<T> {
    this.response.total = total;
    return this;
  }

  // accessToken(accessToken: string): ResponseOkBuilder<T> {
  //   this.response.accessToken = accessToken;
  //   return this;
  // }

  build(): ResponseOk<T> {
    return this.response;
  }
}

interface ResponseOkOptions {
  message?: string;
  status?: number;
  code?: string;
  data?: any;
  filtered?: number;
  pages?: number;
  size?: number;
  total?: number;
  // accessToken?: string;
}
