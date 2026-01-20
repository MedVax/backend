import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @IsString()
  @IsUUID()
  @ApiProperty({ example: 'client-profile-uuid-here' })
  id: string;

  @IsString()
  @IsUUID()
  @IsOptional()
  @ApiProperty({ example: 'consultant-profile-uuid-here' })
  userProfileConsultantId?: string;
}
