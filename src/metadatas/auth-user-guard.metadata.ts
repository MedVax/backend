import { AuthGuardType } from 'enums/auth-guard-type.enum';
import { Auth } from './auth.metadata';

export const AuthUserGuard = (types: string[] = []) =>
  Auth({ allow: false, types, guards: [AuthGuardType.USER] });
