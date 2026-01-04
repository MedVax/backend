import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TokenToAuthUserMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}
  use(req: Request<any>, res: Response, next: NextFunction) {
    try {
      if (!req?.authUser) {
        const accessToken = this.extractTokenFromHeader(req);
        if (accessToken) {
          const { user } = this.jwtService.decode(accessToken);
          if (user) {
            req.authUser = user;
          }
        }
      }
    } catch (error) {
      console.error('Error in TokenToAuthUserMiddleware', error);
      throw new ForbiddenException({ message: 'Invalid token' });
    }

    next();
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
