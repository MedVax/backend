import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserType } from 'generated/prisma/enums';
import { IsEnum, IsOptional } from 'class-validator';

export class GetUsersFilterQuery {
  @ApiPropertyOptional({
    required: false,
    description: 'Search by first name, last name, email',
  })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    required: false,
    enum: UserType,
    isArray: true,
    description: 'User type params',
  })
  @IsEnum(UserType, { each: true })
  @IsOptional()
  type?: UserType[] | UserType;
}
