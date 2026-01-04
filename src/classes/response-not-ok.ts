export class ResponseNotOk {
  name?: string;
  status?: number;
  message?: string;
  description?: string;
  timestamp?: number;
  path?: string;

  constructor(options?: ResponseNotOkOptions) {
    this.name = options?.name;
    this.status = options?.status;
    this.message = options?.message;
    this.description = options?.description;
    this.timestamp = options?.timestamp;
    this.path = options?.path;
  }

  static builder() {
    return new ResponseNotOkBuilder();
  }
}

export class ResponseNotOkBuilder {
  private response = new ResponseNotOk();

  name(name: string): ResponseNotOkBuilder {
    this.response.name = name;
    return this;
  }

  status(status: number): ResponseNotOkBuilder {
    this.response.status = status;
    return this;
  }

  message(message: string): ResponseNotOkBuilder {
    this.response.message = message;
    return this;
  }

  description(description: string): ResponseNotOkBuilder {
    this.response.description = description;
    return this;
  }

  timestamp(timestamp: number): ResponseNotOkBuilder {
    this.response.timestamp = timestamp;
    return this;
  }

  path(path: string): ResponseNotOkBuilder {
    this.response.path = path;
    return this;
  }

  build(): ResponseNotOk {
    return this.response;
  }
}

interface ResponseNotOkOptions {
  name?: string;
  status?: number;
  message?: string;
  description?: string;
  timestamp?: number;
  path?: string;
}
