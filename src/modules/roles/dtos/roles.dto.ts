import { ApiProperty } from '@nestjs/swagger';
import type { Role } from 'generated/prisma/client';
import { TransformPlainToInstance, Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class RoleDto {
  @IsString()
  @ApiProperty()
  name: string;

  @IsString()
  @IsOptional()
  @ApiProperty()
  description?: string;

  @IsString()
  @IsOptional()
  @ApiProperty()
  userId?: string;

  @Type(() => Date)
  @ApiProperty({ type: Date })
  createdAt: Date;

  @Type(() => Date)
  @ApiProperty({ type: Date })
  updatedAt: Date;

  @TransformPlainToInstance(RoleDto)
  static fromModel(model: Role) {
    return model as unknown as RoleDto;
  }
}

export class CreateRoleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsArray()
  permissionIds: string[];
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  permissionIds?: string[];
}

export class AssignPermissionsDto {
  @IsArray()
  permissionIds: string[];
}
