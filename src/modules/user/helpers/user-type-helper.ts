import { ForbiddenException } from '@nestjs/common';
import type { User } from 'generated/prisma/client';
import { UserType } from 'generated/prisma/enums';

export class UserTypeHelper {
  static isSuperAdmin(user: User) {
    return user?.type === UserType.SUPER_ADMIN;
  }

  static isSuperAdminThenThrow(
    user: User,
    errorOrMessage?: Error | string,
    description?: string,
  ): boolean {
    if (UserTypeHelper.isSuperAdmin(user)) {
      throw typeof errorOrMessage !== 'string'
        ? new ForbiddenException(errorOrMessage, { description })
        : new ForbiddenException(errorOrMessage, { description });
    }
    return true;
  }

  static isAdmin(user: User) {
    return user?.type === UserType.ADMIN || UserTypeHelper.isSuperAdmin(user);
  }

  static isAdminThenThrow(
    user: User,
    errorOrMessage?: Error | string,
    description?: string,
  ): boolean {
    if (UserTypeHelper.isAdmin(user)) {
      throw typeof errorOrMessage !== 'string'
        ? new ForbiddenException(errorOrMessage, { description })
        : new ForbiddenException(errorOrMessage, { description });
    }
    return true;
  }
}
