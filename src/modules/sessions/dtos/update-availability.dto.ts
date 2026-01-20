import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TimeIntervalDto {
  @ApiProperty({ example: 9, description: 'Start hour (0-23)' })
  @IsNumber()
  @Min(0)
  @Max(23)
  @IsNotEmpty()
  start: number;

  @ApiProperty({ example: 17, description: 'End hour (0-23)' })
  @IsNumber()
  @Min(0)
  @Max(23)
  @IsNotEmpty()
  end: number;
}

export class WeeklyAvailabilityDto {
  @ApiPropertyOptional({ type: [TimeIntervalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  monday?: TimeIntervalDto[];

  @ApiPropertyOptional({ type: [TimeIntervalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  tuesday?: TimeIntervalDto[];

  @ApiPropertyOptional({ type: [TimeIntervalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  wednesday?: TimeIntervalDto[];

  @ApiPropertyOptional({ type: [TimeIntervalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  thursday?: TimeIntervalDto[];

  @ApiPropertyOptional({ type: [TimeIntervalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  friday?: TimeIntervalDto[];

  @ApiPropertyOptional({ type: [TimeIntervalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  saturday?: TimeIntervalDto[];

  @ApiPropertyOptional({ type: [TimeIntervalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  sunday?: TimeIntervalDto[];
}

export class CustomAvailabilityItemDto {
  @ApiPropertyOptional({ example: 'uuid-of-custom-availability' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    example: '2024-01-15',
    description: 'Date in YYYY-MM-DD format',
  })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ type: [TimeIntervalDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeIntervalDto)
  intervals: TimeIntervalDto[];
}

export class UpdateAvailabilityDto {
  @ApiProperty({ example: 'Africa/Lagos', description: 'Timezone identifier' })
  @IsString()
  @IsNotEmpty()
  timezone: string;

  @ApiProperty({ type: WeeklyAvailabilityDto })
  @IsObject()
  @ValidateNested()
  @Type(() => WeeklyAvailabilityDto)
  weekly: WeeklyAvailabilityDto;

  @ApiPropertyOptional({ type: [CustomAvailabilityItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomAvailabilityItemDto)
  custom?: CustomAvailabilityItemDto[];
}
