import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

export class BulkCreateCategoryDto {
  @ApiProperty({
    type: [CreateCategoryDto],
    description: 'Array of categories to create (max 100 at a time)',
    example: [
      {
        name: 'Contraceptives',
        slug: 'contraceptives',
        description: 'Contraceptive products',
      },
      {
        name: 'Pain Relief',
        slug: 'pain-relief',
        description: 'Pain relief medications',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one category is required' })
  @ArrayMaxSize(100, {
    message: 'Cannot create more than 100 categories at once',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateCategoryDto)
  categories: CreateCategoryDto[];
}
