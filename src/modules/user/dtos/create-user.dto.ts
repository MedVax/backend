import { ApiProperty } from '@nestjs/swagger';
import type { User } from 'generated/prisma/client';
import { UserStatus, UserType } from 'generated/prisma/enums';
import { TransformPlainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsEmail()
  @ApiProperty({ example: 'sylvernus@tmpbox.net' })
  email: string;

  @IsString()
  @ApiProperty()
  @ApiProperty({ example: 'Sylvernus' })
  firstName: string;

  @IsString()
  @ApiProperty({ example: 'Makori' })
  lastName: string;

  @IsString()
  @ApiProperty({ example: 'password' })
  password: string;

  @IsEnum(UserType)
  @ApiProperty({ enum: UserType })
  type: UserType;

  @IsEnum(UserStatus)
  @IsOptional()
  @ApiProperty()
  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status?: UserStatus;

  @ValidateIf(
    (req) => req.type === UserType.USER || req.type === UserType.ADMIN,
  )
  @ApiProperty()
  userRoleIds: string[];

  @TransformPlainToInstance(Object)
  toModel(existing?: Partial<User>) {
    return {
      ...existing,
      email: this.email ?? existing?.email,
      firstName: this.firstName ?? existing?.firstName,
      lastName: this.lastName ?? existing?.lastName,
      password: this.password ?? existing?.password,
      type: this.type ?? existing?.type,
      status: this.status ?? existing?.status,
    } as User;
  }
}

export const UserCreateDto = CreateUserDto;
