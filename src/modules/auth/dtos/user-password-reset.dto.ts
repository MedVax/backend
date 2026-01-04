import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UserPasswordResetDto {
  @IsString()
  @ApiProperty({ example: 'Ae/KoelSOL/+eiemsmmlksO' })
  token: string;

  @MinLength(4)
  @MaxLength(20)
  @IsStrongPassword({
    minLength: 4,
    minLowercase: 0,
    minNumbers: 0,
    minUppercase: 0,
    minSymbols: 0,
  })
  @IsString()
  @ApiProperty()
  newPassword: string;

  @IsString()
  @ApiProperty()
  confirmNewPassword: string;
}
