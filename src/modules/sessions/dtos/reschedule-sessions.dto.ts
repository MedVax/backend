import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsString, IsOptional } from 'class-validator';

export class RescheduleSessionsDto {
  @ApiProperty({ example: 'uuid', description: 'Session ID' })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    example: '2024-01-20T10:00:00Z',
    description: 'New session date (ISO string)',
  })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'uuid', description: 'Consultant ID' })
  @IsUUID()
  consultantId: string;

  @ApiPropertyOptional({
    example: 'Need to reschedule due to emergency',
    description: 'Reason for rescheduling',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
