import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyOtpDTO {
  @IsString()
  @ApiProperty({ type: String, example: '234567' })
  otp: string;
}
