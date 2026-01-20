import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsString, IsOptional } from 'class-validator';

export class CancelSessionsDto {
  @ApiProperty({ example: 'uuid', description: 'Session ID' })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    example: '2024-01-15T10:00:00Z',
    description: 'Session date (ISO string)',
  })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'uuid', description: 'Consultant ID' })
  @IsUUID()
  consultantId: string;

  @ApiPropertyOptional({
    example: 'Unable to attend due to emergency',
    description: 'Cancellation reason',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
