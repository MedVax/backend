import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ example: '3433' })
  @IsString()
  @IsUUID()
  userId: string;

  @IsArray()
  @IsOptional()
  roles: string[];
}
