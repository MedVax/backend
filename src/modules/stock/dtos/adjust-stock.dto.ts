import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({
    example: 100,
    description: 'Quantity to add (positive) or subtract (negative)',
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 'Manual stock adjustment - inventory count' })
  @IsString()
  reason: string;
}
