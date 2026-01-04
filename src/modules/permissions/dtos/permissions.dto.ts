import { IsArray, IsOptional, IsString } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  permissionIds: string[];
}

export class CreatePermissionDto {
  @IsString()
  name: string;

  @IsString()
  value: string;

  @IsString()
  group: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePermissionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
