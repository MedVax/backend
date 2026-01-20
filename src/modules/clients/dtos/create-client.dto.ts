import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @ApiProperty({ example: 'John Doe' })
  firstName: string;

  @IsString()
  @ApiProperty({ example: 'John Doe' })
  lastName: string;

  @IsString()
  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @IsString()
  @ApiProperty({ example: 'password' })
  password: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'John Doe', required: false })
  coverName?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'Referral source', required: false })
  referral?: string;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ example: false, required: false })
  useCoverName?: boolean;
}
