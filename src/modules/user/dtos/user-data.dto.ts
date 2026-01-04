import { ApiProperty } from '@nestjs/swagger';
import { UserType } from 'generated/prisma/enums';
import { UserStatus } from 'generated/prisma/enums';
import { TransformPlainToInstance, Type } from 'class-transformer';
import { UserExpanded } from '../types/user';

export class UserDataDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String })
  avatar: string | null;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  type: UserType;

  @ApiProperty()
  status: UserStatus;

  @ApiProperty()
  firstTimeLogin: boolean;

  @ApiProperty()
  lastLoginAt: Date | null;

  @ApiProperty()
  organizationId: string | null;

  @Type(() => Date)
  @ApiProperty({ type: Date })
  createdAt: Date;

  @Type(() => Date)
  @ApiProperty({ type: Date })
  updatedAt: Date;

  @TransformPlainToInstance(UserDataDto)
  static fromModel(model: Partial<UserExpanded>) {
    if (!model) return null;

    return {
      ...model,
    } as UserDataDto;
  }
}
