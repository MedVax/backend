import { UserType } from 'generated/prisma/enums';
import { AuthUserGuard } from './auth-user-guard.metadata';

export const AuthSuperAdminOrAdmin = () =>
  AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN]);
