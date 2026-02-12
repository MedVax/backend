import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GuestInfoDto } from './guest-info.dto';
import { OrderRecurringFrequency } from 'generated/prisma/enums';

export class CreateOrderDto {
  // For authenticated users
  @ApiPropertyOptional({ example: 'address-uuid' })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => !o.guestInfo)
  deliveryAddressId?: string;

  // For anonymous users - guest information
  @ApiPropertyOptional({
    type: GuestInfoDto,
    description: 'Guest information (required for anonymous checkout)',
    example: {
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+2348012345678',
      addressLine1: '123 Main Street',
      addressLine2: 'Apartment 4B',
      city: 'Lagos',
      state: 'Lagos State',
      postalCode: '100001',
      country: 'Nigeria',
    },
  })
  @ValidateNested()
  @Type(() => GuestInfoDto)
  @IsOptional()
  @ValidateIf((o) => !o.deliveryAddressId)
  guestInfo?: GuestInfoDto;

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

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Whether this order is recurring or one-time',
  })
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    enum: OrderRecurringFrequency,
    example: OrderRecurringFrequency.WEEKLY,
    description:
      'Recurring frequency (required if isRecurring is true). Must be WEEKLY or MONTHLY.',
  })
  @IsEnum(OrderRecurringFrequency)
  @IsOptional()
  @ValidateIf((o) => o.isRecurring === true)
  recurringFrequency?: OrderRecurringFrequency;

  @ApiPropertyOptional({
    example: 100000,
    description:
      'Delivery fee in minor currency units (kobo). If not provided, will be calculated automatically (same-day delivery).',
  })
  @IsOptional()
  deliveryFee?: number;
}
