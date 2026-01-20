import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { UserProfileType } from 'generated/prisma/enums';

export class UserSigninDto {
  @IsEmail()
  @ApiProperty({ example: 'sylvernus@tmpbox.net' })
  email: string;

  @IsString()
  @ApiProperty({ example: 'Fraudspect1!' })
  password: string;

  @IsEnum(UserProfileType)
  @IsOptional()
  @ApiProperty({
    enum: UserProfileType,
    required: false,
    example: UserProfileType.CLIENT,
    description: 'Profile type to use for login (CLIENT or CONSULTANT)',
  })
  profileType?: UserProfileType;
}
