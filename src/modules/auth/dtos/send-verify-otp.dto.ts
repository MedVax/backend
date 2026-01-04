import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendVerifyOtpDTO {
  @IsEmail()
  @ApiProperty({ example: 'test@gmail.com' })
  email: string;
}
