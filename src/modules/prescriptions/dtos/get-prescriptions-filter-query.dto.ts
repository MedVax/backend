import { ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionStatus, PrescriptionType } from 'generated/prisma/enums';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetPrescriptionsFilterQuery {
  @ApiPropertyOptional({
    required: false,
    description: 'Search by patient name, prescriber name, drug name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    required: false,
    enum: PrescriptionStatus,
    isArray: true,
    description: 'Filter by prescription status',
  })
  @IsEnum(PrescriptionStatus, { each: true })
  @IsOptional()
  status?: PrescriptionStatus[] | PrescriptionStatus;

  @ApiPropertyOptional({
    required: false,
    enum: PrescriptionType,
    description: 'Filter by prescriber type',
  })
  @IsEnum(PrescriptionType)
  @IsOptional()
  prescriberType?: PrescriptionType;

  @ApiPropertyOptional({
    required: false,
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
