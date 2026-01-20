import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  Min,
} from 'class-validator';
import { ProductType } from 'generated/prisma/enums';

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

  @ApiPropertyOptional({ example: 'Pfizer' })
  @IsString()
  @IsOptional()
  brand?: string;

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
    example: ['500mg', '1000mg', '250mg'],
    type: [String],
    description: 'Available dosages for this product',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dosages?: string[];

  @ApiPropertyOptional({
    example: ['10 tablets', '20 tablets', '30 tablets'],
    type: [String],
    description: 'Available package sizes for this product',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  packageSizes?: string[];

  @ApiPropertyOptional({
    example: 'Take one tablet daily with water after meals',
    description: 'Instructions on how to use this product',
  })
  @IsString()
  @IsOptional()
  howToUse?: string;

  @ApiPropertyOptional({
    example: ['Paracetamol', 'Caffeine', 'Codeine'],
    type: [String],
    description: 'List of active ingredients in this product',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ingredients?: string[];

  @ApiPropertyOptional({
    example: 'Store in a cool, dry place. Keep away from children.',
    description: 'Pharmacy advice or warnings for this product',
  })
  @IsString()
  @IsOptional()
  pharmacyAdvise?: string;

  @ApiPropertyOptional({
    example: 'Weight: 500mg, Form: Tablets, Pack size: 20 tablets',
    description: 'Product specifications and technical details',
  })
  @IsString()
  @IsOptional()
  specification?: string;
}
