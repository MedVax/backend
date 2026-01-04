import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsString } from 'class-validator';

export class UserPasswordLessSigninDto {
  @IsString()
  @IsEmail()
  @ApiProperty()
  email: string;

  @IsNumber()
  @ApiProperty()
  organizationId: number;
}
