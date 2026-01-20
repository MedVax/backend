import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class GetClientDto {
  @IsString()
  @IsUUID()
  @ApiProperty({ example: 'client-profile-uuid-here' })
  id: string;
}
