import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UserContactUsDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  @ApiProperty()
  email: string;

  @IsString()
  @IsOptional()
  phoneNumber: string;

  @IsString()
  message: string;
}
