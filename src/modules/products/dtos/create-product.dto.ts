import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from 'generated/prisma/enums';

export class ProductStockDto {
  @ApiProperty({ example: 'pharmacy-uuid' })
  @IsString()
  pharmacyId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  quantity: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Emergency Contraceptive' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'EC-001' })
  @IsString()
  sku: string;

  @ApiPropertyOptional({ example: 'Single dose emergency contraceptive' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 4500 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'NGN', default: 'NGN' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  requiresPrescription?: boolean;

  @ApiPropertyOptional({ enum: ProductType, default: ProductType.OTC })
  @IsEnum(ProductType)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    example: ['https://example.com/image1.jpg'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({
    type: [ProductStockDto],
    description: 'Stock quantities per pharmacy',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductStockDto)
  @IsOptional()
  stock?: ProductStockDto[];
}
