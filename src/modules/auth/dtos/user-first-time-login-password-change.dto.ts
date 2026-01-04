import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UserFirstTimePasswordChangeDto {
  @IsString()
  @ApiProperty()
  newPassword: string;
}
