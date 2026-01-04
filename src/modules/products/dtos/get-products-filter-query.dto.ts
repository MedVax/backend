import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { ProductType } from 'generated/prisma/enums';

export class GetProductsFilterQuery {
  @ApiPropertyOptional({
    required: false,
    description: 'Search by name, SKU, description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    required: false,
    description: 'Filter by category ID',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    required: false,
    enum: ProductType,
    description: 'Filter by product type',
  })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @ApiPropertyOptional({
    required: false,
    description: 'Filter by requires prescription',
  })
  @IsOptional()
  @IsBoolean()
  requiresPrescription?: boolean;

  @ApiPropertyOptional({
    required: false,
    description: 'Filter by active status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
