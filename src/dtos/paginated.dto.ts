import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class PaginatedDto<TData> {
  @ApiProperty()
  count: number;

  @ApiProperty()
  take: number;

  @ApiProperty()
  skip: number;

  @ApiHideProperty()
  data: TData[];
}
