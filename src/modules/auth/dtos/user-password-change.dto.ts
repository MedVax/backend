import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UserPasswordChangeDto {
  @IsString()
  @ApiProperty()
  oldPassword: string;

  @IsString()
  @ApiProperty()
  newPassword: string;
}
