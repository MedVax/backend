import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class GetConsultantDto {
  @IsString()
  @IsUUID()
  @ApiProperty({ example: 'consultant-profile-uuid-here' })
  id: string;
}
