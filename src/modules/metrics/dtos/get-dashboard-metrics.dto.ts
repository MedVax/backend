import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum DateRangePreset {
  TODAY = 'today',
  LAST_7_DAYS = '7days',
  LAST_30_DAYS = '30days',
  LAST_90_DAYS = '90days',
  LAST_YEAR = '1year',
  CUSTOM = 'custom',
}

export class GetDashboardMetricsDto {
  @ApiPropertyOptional({
    enum: DateRangePreset,
    description: 'Date range preset for metrics',
    example: DateRangePreset.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(DateRangePreset)
  dateRange?: DateRangePreset;

  @ApiPropertyOptional({
    description: 'Start date for custom range (ISO 8601 format)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for custom range (ISO 8601 format)',
    example: '2026-02-01T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
