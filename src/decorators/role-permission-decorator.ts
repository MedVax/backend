import { applyDecorators, SetMetadata } from '@nestjs/common';
import { PermissionMatchModeEnum } from 'modules/permissions/enums/permissions.enum';

export type PermissionMatchMode = 'every' | 'some' | 'none';

export const REQUIRE_PERMISSIONS_KEY = 'permissions';
export const PERMISSION_MATCH_MODE_KEY = 'permission_match_mode';

export const RequirePermissions = (
  permissions: string[],
  match: PermissionMatchMode = PermissionMatchModeEnum.EVERY,
) => {
  return applyDecorators(
    SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSION_MATCH_MODE_KEY, match),
  );
};
