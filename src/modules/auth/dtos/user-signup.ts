import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsStrongPassword } from 'class-validator';

export class UserSignupDto {
  @IsString()
  @ApiProperty({ example: 'Sylvernus' })
  firstName: string;

  @IsString()
  @ApiProperty({ example: 'Akubo' })
  lastName: string;

  @IsString()
  @ApiProperty({ example: 'sylvernus@tmpbox.net' })
  @IsEmail()
  email: string;

  @IsString()
  @ApiProperty({ example: 'Fraudspect1!' })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;
}
