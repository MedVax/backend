import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class VerifyOtpDTO {
  @IsEmail()
  @ApiProperty({ example: 'test@gmail.com' })
  email: string;

  @IsString()
  @ApiProperty({ type: String, example: '234567' })
  otp: string;
}
