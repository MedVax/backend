import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class PaginationQuery {
  @ApiPropertyOptional({
    default: 0,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  skip?: number;

  @ApiPropertyOptional({
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  take?: number;
}
