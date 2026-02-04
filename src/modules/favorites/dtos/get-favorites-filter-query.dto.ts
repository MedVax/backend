import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetFavoritesFilterQuery {
  @ApiPropertyOptional({
    required: false,
    description: 'Search by product name, category, or brand',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
