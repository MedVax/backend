import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreatePrescriptionDto {
  @ApiPropertyOptional({ example: 'order-uuid' })
  @IsString()
  @IsOptional()
  orderId?: string;

  @ApiProperty({ example: 'https://example.com/prescription.jpg' })
  @IsString()
  fileUrl: string;

  // Patient info fields (for patient-submitted)
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  patientName?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsString()
  @IsOptional()
  patientLocation?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsString()
  @IsOptional()
  patientEmail?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsString()
  @IsOptional()
  patientPhone?: string;

  @ApiPropertyOptional({ example: 'Additional notes' })
  @IsString()
  @IsOptional()
  additionalNote?: string;

  // Doctor info fields (for doctor-submitted)
  @ApiPropertyOptional({ example: 'Dr. Jane Smith' })
  @IsString()
  @IsOptional()
  prescriberName?: string;

  @ApiPropertyOptional({ example: 'jane@hospital.com' })
  @IsString()
  @IsOptional()
  prescriberEmail?: string;

  @ApiPropertyOptional({ example: '+2348012345679' })
  @IsString()
  @IsOptional()
  prescriberPhone?: string;

  @ApiPropertyOptional({ example: 'General Hospital' })
  @IsString()
  @IsOptional()
  prescriberHospital?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsString()
  @IsOptional()
  prescriberLocation?: string;

  @ApiPropertyOptional({ example: 'Lagos General Hospital' })
  @IsString()
  @IsOptional()
  hospitalName?: string;

  @ApiPropertyOptional({ example: 'Paracetamol 500mg' })
  @IsString()
  @IsOptional()
  drugName?: string;

  @ApiPropertyOptional({ example: 'Take 2 tablets twice daily' })
  @IsString()
  @IsOptional()
  dosage?: string;
}
