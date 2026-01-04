import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
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
}
