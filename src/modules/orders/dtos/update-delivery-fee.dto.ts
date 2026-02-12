import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateDeliveryFeeDto {
  @ApiProperty({
    example: 100000,
    description:
      'Delivery fee in minor currency units (kobo). Example: 100000 = ₦1,000',
  })
  @IsNumber()
  @Min(0, { message: 'Delivery fee must be greater than or equal to 0' })
  deliveryFee: number;
}
