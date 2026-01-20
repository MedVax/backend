import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  IsNumber,
  Min,
  IsEnum,
  IsEmail,
} from 'class-validator';
import { AvailabilityPeriod } from 'generated/prisma/enums';

export class CreateConsultantDto {
  @IsString()
  @ApiProperty({ example: 'John Doe' })
  firstName: string;

  @IsString()
  @ApiProperty({ example: 'John Doe' })
  lastName: string;

  @IsString()
  @IsEmail()
  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @IsString()
  @ApiProperty({ example: 'password' })
  password: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'video-url-here', required: false })
  introVideo?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: 'Experienced healthcare professional...',
    required: false,
  })
  bio?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @ApiProperty({ example: 5000.0, required: false })
  rate?: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'General Practitioner', required: false })
  jobTitle?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ApiProperty({
    example: ['Cardiology', 'Internal Medicine'],
    required: false,
  })
  areaOfExpertise?: string[];

  @IsInt()
  @IsOptional()
  @Min(0)
  @ApiProperty({ example: 10, required: false })
  yearsOfExperience?: number;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: 'Christian', required: false })
  faith?: string;

  @IsEnum(AvailabilityPeriod)
  @IsOptional()
  @ApiProperty({ enum: AvailabilityPeriod, required: false })
  availabilityPeriod?: AvailabilityPeriod;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ example: false, required: false })
  offerFaithTherapy?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({ example: false, required: false })
  hasSetAvailability?: boolean;
}
