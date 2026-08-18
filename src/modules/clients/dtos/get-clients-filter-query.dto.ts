import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetClientsFilterQuery {
  @ApiPropertyOptional({
    required: false,
    description: 'Search by client name, email, cover name or referral',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
