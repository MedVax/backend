export class PaginatedResult<T> {
  data: T[];
  total: number;
  filtered: number;
  size: number;
  pages: number;

  constructor(options: PaginatedResultOptions<T>) {
    this.data = options.data;
    this.total = options.total;
    this.filtered = options.filtered;
    this.size = options.size;
    this.pages = options.pages;
  }
}

interface PaginatedResultOptions<T> {
  data: T[];
  total: number;
  filtered: number;
  size: number;
  pages: number;
}
