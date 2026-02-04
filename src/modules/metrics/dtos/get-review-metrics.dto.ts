import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class GetReviewMetricsDto {
  @ApiPropertyOptional({
    description: 'Start date for the review metrics (ISO 8601 format)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for the review metrics (ISO 8601 format)',
    example: '2026-02-01T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
