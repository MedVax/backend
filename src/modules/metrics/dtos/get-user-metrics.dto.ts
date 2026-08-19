import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserType } from 'generated/prisma/enums';

export class GetUserMetricsDto {
  @ApiPropertyOptional({
    enum: UserType,
    isArray: true,
    description:
      'Restrict the counts to these user types. Omit to count every user.',
    example: [UserType.ADMIN, UserType.SUPER_ADMIN],
  })
  @IsOptional()
  // A single `?type=ADMIN` arrives as a string; the counts always want a list.
  @Transform(({ value }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @IsEnum(UserType, { each: true })
  type?: UserType[];
}
