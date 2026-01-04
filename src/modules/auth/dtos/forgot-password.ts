import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @ApiProperty({ example: 'silva@tmpbox.net' })
  email: string;
}
