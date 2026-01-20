import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PermissionEnum,
  PermissionMatchModeEnum,
} from 'modules/permissions/enums/permissions.enum';
import {
  PERMISSION_MATCH_MODE_KEY,
  REQUIRE_PERMISSIONS_KEY,
  PermissionMatchMode,
} from 'src/decorators/role-permission-decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const matchMode =
      this.reflector.getAllAndOverride<PermissionMatchMode>(
        PERMISSION_MATCH_MODE_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? PermissionMatchModeEnum.EVERY;

    if (!requiredPermissions) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.authUser;

    const roles = user.userRoles.map((role) => role.role);

    if (!user || !roles) return false;

    const userPermissions = roles.flatMap((role) =>
      role.permissions.map((permission) => permission.permission.value),
    );

    if (userPermissions?.length === 0) {
      throw new ForbiddenException(
        'You do not have any permissions assigned to your roles',
      );
    }

    const hasBypass =
      userPermissions.includes('*') ||
      userPermissions.includes(PermissionEnum.ALL_ACCESS);

    if (hasBypass) return true;

    const permissionCheck = {
      every: () =>
        requiredPermissions?.every((permission) =>
          userPermissions.includes(permission),
        ),
      some: () =>
        requiredPermissions?.some((permission) =>
          userPermissions.includes(permission),
        ),
      none: () =>
        requiredPermissions?.every(
          (permission) => !userPermissions.includes(permission),
        ),
    };

    const hasPermission = permissionCheck[matchMode]();

    if (!hasPermission) {
      throw new ForbiddenException(
        `You do not have permission to perform this action (mode: ${matchMode})`,
      );
    }

    return true;
  }
}
