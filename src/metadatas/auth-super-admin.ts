import { UserType } from 'generated/prisma/enums';
import { AuthUserGuard } from './auth-user-guard.metadata';

export const AuthSuperAdmin = () => AuthUserGuard([UserType.SUPER_ADMIN]);
