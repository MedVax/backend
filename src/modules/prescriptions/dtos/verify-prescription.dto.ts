import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PrescriptionStatus } from 'generated/prisma/enums';

export class VerifyPrescriptionDto {
  @ApiProperty({ enum: PrescriptionStatus })
  @IsEnum(PrescriptionStatus)
  status: PrescriptionStatus;

  @ApiPropertyOptional({ example: 'Prescription verified and approved' })
  @IsString()
  @IsOptional()
  notes?: string;
}
