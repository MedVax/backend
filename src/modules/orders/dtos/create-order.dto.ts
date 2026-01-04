import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'address-uuid' })
  @IsString()
  deliveryAddressId: string;

  @ApiPropertyOptional({ example: 'pharmacy-uuid' })
  @IsString()
  @IsOptional()
  pharmacyId?: string;

  @ApiPropertyOptional({
    example: 'paystack',
    enum: ['paystack', 'flutterwave'],
  })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({
    example: ['https://example.com/prescription1.jpg'],
    type: [String],
    description:
      'Prescription file URLs (required for prescription-only products)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  prescriptionUploads?: string[];

  @ApiPropertyOptional({ example: 'Please deliver after 4pm' })
  @IsString()
  @IsOptional()
  notes?: string;
}
