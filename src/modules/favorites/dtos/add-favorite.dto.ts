import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AddFavoriteDto {
  @ApiProperty({
    description: 'Product ID to add to favorites',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  productId: string;
}
