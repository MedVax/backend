import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsString } from 'class-validator';

export class UserRequestDemoDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  @ApiProperty()
  email: string;

  @IsString()
  phoneNumber: string;

  @IsString()
  companyName: string;

  @IsString()
  message: string;

  @IsNumber()
  membersCount: number;

  @IsString()
  demoDate: string;
}
