import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreatePharmacyDto {
  @ApiProperty({ example: 'MedVax Pharmacy Lagos' })
  @IsString()
  name: string;

  @ApiProperty({
    example: {
      line1: '123 Pharmacy Street',
      city: 'Lagos',
      state: 'Lagos State',
      postalCode: '100001',
      country: 'Nigeria',
    },
  })
  @IsObject()
  address: Record<string, any>;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'pharmacy@medvax.com' })
  @IsString()
  @IsOptional()
  email?: string;
}
