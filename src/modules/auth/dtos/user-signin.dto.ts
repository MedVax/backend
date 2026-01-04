import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class UserSigninDto {
  @IsEmail()
  @ApiProperty({ example: 'sylvernus@tmpbox.net' })
  email: string;

  @IsString()
  @ApiProperty({ example: 'Fraudspect1!' })
  password: string;
}
