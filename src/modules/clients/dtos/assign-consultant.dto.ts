import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignConsultantDto {
  @ApiProperty({
    example: 'uuid-of-client',
    description: 'ID of the client profile',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiPropertyOptional({
    example: 'uuid-of-consultant',
    description:
      'ID of the consultant to assign. If not provided or null, removes the assigned consultant.',
  })
  @IsString()
  @IsOptional()
  consultantId?: string | null;
}
