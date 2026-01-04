import { AuthGuardType } from 'enums/auth-guard-type.enum';
import { Auth } from './auth.metadata';

export const AuthTwoFactor = () =>
  Auth({ allow: false, guards: [AuthGuardType.TWO_FACTOR] });
