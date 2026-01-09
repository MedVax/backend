import { AuthGuardType } from 'enums/auth-guard-type.enum';
import { UserStatus, UserType } from 'generated/prisma/enums';

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from 'generated/prisma/client';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allow = this.reflector.getAllAndOverride<boolean>('allow', [
      context.getHandler(),
      context.getClass(),
    ]);

    const guards = this.reflector.getAllAndOverride<string[]>('guards', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allow) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { authUser: User }>();
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException(
        'This account is deactivated. Please contact support',
      );
    }

    const isUser = !!user.email;

    if (isUser && (!guards?.length || guards.includes(AuthGuardType.USER))) {
      const types = this.reflector.getAllAndMerge<string[]>('types', [
        context.getHandler(),
        context.getClass(),
      ]);

      if (
        !types?.length ||
        user.type === UserType.SUPER_ADMIN ||
        types.includes(user.type)
      ) {
        return true;
      }
    }

    throw new ForbiddenException();
  }
}
