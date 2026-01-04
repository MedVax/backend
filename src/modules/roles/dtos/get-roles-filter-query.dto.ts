import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class GetRolesFilterQuery {
  @ApiPropertyOptional({
    required: false,
    description: 'Search by role name',
  })
  @IsOptional()
  search?: string;

  @IsOptional()
  organizationId?: string;
}
