import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Contraceptives' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Contraceptive products' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'contraceptives' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    example: 'parent-category-uuid',
    description: 'Parent category ID for subcategories',
  })
  @IsString()
  @IsOptional()
  parentId?: string;
}
