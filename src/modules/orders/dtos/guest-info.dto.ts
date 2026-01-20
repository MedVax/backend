import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class GuestInfoDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Guest email (required for anonymous checkout)',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'Guest first name (required for anonymous checkout)',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Guest last name (required for anonymous checkout)',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: '+2348012345678',
    description: 'Guest phone (required for anonymous checkout)',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    example: '123 Main Street',
    description: 'Guest address line 1 (required for anonymous checkout)',
  })
  @IsString()
  addressLine1: string;

  @ApiPropertyOptional({
    example: 'Apartment 4B',
    description: 'Guest address line 2 (optional for anonymous checkout)',
  })
  @IsString()
  @IsOptional()
  addressLine2?: string;

  @ApiProperty({
    example: 'Lagos',
    description: 'Guest city (required for anonymous checkout)',
  })
  @IsString()
  city: string;

  @ApiProperty({
    example: 'Lagos State',
    description: 'Guest state (required for anonymous checkout)',
  })
  @IsString()
  state: string;

  @ApiPropertyOptional({
    example: '100001',
    description: 'Guest postal code (optional for anonymous checkout)',
  })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({
    example: 'Nigeria',
    description:
      'Guest country (optional for anonymous checkout, defaults to Nigeria)',
  })
  @IsString()
  @IsOptional()
  country?: string;
}
