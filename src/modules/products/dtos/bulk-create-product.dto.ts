import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';

export class BulkCreateProductDto {
  @ApiProperty({
    type: [CreateProductDto],
    description: 'Array of products to create (max 100 at a time)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one product is required' })
  @ArrayMaxSize(100, {
    message: 'Cannot create more than 100 products at once',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  products: CreateProductDto[];
}
