import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { IS_PRODUCTION } from 'constants/env.constant';

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

@Injectable()
export class SessionCookieService {
  private readonly DEFAULT_COOKIE_NAME = 'sessionId';

  /**
   * Get sessionId from cookies, or generate and set a new one if it doesn't exist
   */
  getOrCreateSessionId(
    req: Request,
    res: Response,
    cookieName: string = this.DEFAULT_COOKIE_NAME,
  ): string {
    let sessionId = req.cookies?.[cookieName];

    if (!sessionId) {
      sessionId = randomUUID();
      this.setSessionCookie(res, sessionId, cookieName);
    }

    return sessionId;
  }

  /**
   * Get sessionId from cookies (without creating a new one)
   */
  getSessionId(
    req: Request,
    cookieName: string = this.DEFAULT_COOKIE_NAME,
  ): string | undefined {
    return req.cookies?.[cookieName];
  }

  /**
   * Set sessionId in response cookies
   */
  setSessionCookie(
    res: Response,
    sessionId: string,
    cookieName: string = this.DEFAULT_COOKIE_NAME,
  ): void {
    const maxAgeInMs =
      typeof SESSION_COOKIE_MAX_AGE === 'number'
        ? SESSION_COOKIE_MAX_AGE * 1000
        : Number(SESSION_COOKIE_MAX_AGE) * 1000; // Convert to milliseconds

    res.cookie(cookieName, sessionId, {
      maxAge: maxAgeInMs,
      httpOnly: true,
      secure: IS_PRODUCTION || process.env.COOKIE_SECURE === 'true',
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      path: '/',
      ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
    });
  }

  /**
   * Clear sessionId cookie
   */
  clearSessionCookie(
    res: Response,
    cookieName: string = this.DEFAULT_COOKIE_NAME,
  ): void {
    res.clearCookie(cookieName, {
      path: '/',
      httpOnly: true,
      secure: IS_PRODUCTION || process.env.COOKIE_SECURE === 'true',
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
    });
  }
}
