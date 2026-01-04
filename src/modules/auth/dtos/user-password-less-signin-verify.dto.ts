import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UserPasswordLessSigninVerifyDto {
  @IsString()
  @ApiProperty()
  token: string;
}
