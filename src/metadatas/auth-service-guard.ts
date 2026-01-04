import { AuthGuardType } from 'enums/auth-guard-type.enum';
import { Auth } from './auth.metadata';

export const AuthServiceGuard = () =>
  Auth({ allow: false, guards: [AuthGuardType.SERVICE] });
