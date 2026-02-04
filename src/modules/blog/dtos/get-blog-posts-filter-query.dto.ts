import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class GetBlogPostsFilterQuery {
  @ApiPropertyOptional({
    required: false,
    description: 'Search by title, excerpt, or content',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    required: false,
    description: 'Filter by published status',
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({
    required: false,
    description: 'Filter by author ID',
  })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    required: false,
    description: 'Filter by tag',
  })
  @IsOptional()
  @IsString()
  tag?: string;
}
