import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';
import { SubscriptionFrequency } from 'generated/prisma/enums';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'product-uuid' })
  @IsString()
  productId: string;

  @ApiProperty({ enum: SubscriptionFrequency })
  @IsEnum(SubscriptionFrequency)
  frequency: SubscriptionFrequency;

  @ApiProperty({ example: '2024-01-15T00:00:00Z' })
  @IsDateString()
  nextRunDate: string;

  @ApiProperty({ example: 2, minimum: 1, default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiProperty({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  autoCharge?: boolean;
}
