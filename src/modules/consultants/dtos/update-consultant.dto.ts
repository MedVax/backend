import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateConsultantDto } from './create-consultant.dto';
import { IsString, IsUUID } from 'class-validator';

export class UpdateConsultantDto extends PartialType(CreateConsultantDto) {
  @IsString()
  @IsUUID()
  @ApiProperty({ example: 'consultant-profile-uuid-here' })
  id: string;
}
