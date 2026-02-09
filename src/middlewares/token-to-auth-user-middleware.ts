import {
  ForbiddenException,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { SessionCookieService } from 'services/session-cookie.service';

@Injectable()
export class TokenToAuthUserMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TokenToAuthUserMiddleware.name);

  constructor(
    private jwtService: JwtService,
    private sessionCookieService: SessionCookieService,
  ) {}
  use(req: Request<any>, res: Response, next: NextFunction) {
    try {
      if (!req?.authUser) {
        const accessToken =
          this.sessionCookieService.getSessionId(req, 'accessToken') ||
          this.extractTokenFromHeader(req);

        if (accessToken) {
          const { user, activeProfile } = this.jwtService.decode(accessToken);
          if (user) {
            req.authUser = {
              ...user,
              ...(activeProfile ? { activeProfile } : {}),
            };
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Token authentication failed: ${error.message}`,
        error.stack,
      );
      throw new ForbiddenException({ message: 'Invalid token' });
    }

    next();
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
