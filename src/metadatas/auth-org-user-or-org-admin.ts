import { UserType } from 'generated/prisma/enums';
import { AuthUserGuard } from './auth-user-guard.metadata';

export const AuthOrgUserOrOrgAdmin = () =>
  AuthUserGuard([UserType.USER, UserType.SUPER_ADMIN]);
