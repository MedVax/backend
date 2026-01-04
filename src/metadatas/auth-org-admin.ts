import { UserType } from 'generated/prisma/enums';
import { AuthUserGuard } from './auth-user-guard.metadata';

export const AuthOrgAdmin = () => AuthUserGuard([UserType.ADMIN]);
