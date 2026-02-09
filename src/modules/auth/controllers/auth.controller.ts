import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response as ExpressResponse } from 'express';

import { AuthAllow } from 'metadatas/auth-allow.metadata';
import { Response } from 'metadatas/response.metadata';
import { UserSigninDto } from '../dtos/user-signin.dto';
import { AuthService } from '../services/auth.service';
import { VerifyOtpDTO } from '../dtos/verify-otp.dto';
import { UserSignupDto } from '../dtos/user-signup';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { SessionCookieService } from 'services/session-cookie.service';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionCookieService: SessionCookieService,
  ) {}

  @Post('signup')
  @AuthAllow()
  @Response({
    status: HttpStatus.OK,
    message: 'Account Created successful',
  })
  async signupUser(
    @Body() dto: UserSignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    // Get sessionId from cookies if it exists
    const sessionId = this.sessionCookieService.getSessionId(req);
    const result = await this.authService.signup(dto, sessionId);

    // Clear session cookie after successful signup since user is now authenticated
    if (sessionId) {
      this.sessionCookieService.clearSessionCookie(res, 'sessionId', req);
    }
    this.sessionCookieService.setSessionCookie(
      res,
      result?.accessToken,
      'accessToken',
      req,
    );
    this.sessionCookieService.setSessionCookie(
      res,
      result?.refreshToken,
      'refreshToken',
      req,
    );
    this.sessionCookieService.setSessionCookie(
      res,
      result?.activeProfile?.type,
      'activeProfileType',
      req,
    );
    return result;
  }

  @Post('/validate-email-otp')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Verified successful' })
  verifyEmailWithOtp(@AuthUser() user: User, @Body() dto: VerifyOtpDTO) {
    return this.authService.verifyEmailWithOTP(dto, user);
  }

  @Get('/verify-email')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'OTP sent successful' })
  sendVerifyOtp(@AuthUser() user: User) {
    return this.authService.sendVerificationOTP(user);
  }

  @Post('signin')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Signin successful' })
  async signinUser(
    @Body() dto: UserSigninDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    // Get sessionId from cookies if it exists
    const sessionId = this.sessionCookieService.getSessionId(req);
    const result = await this.authService.signin(dto, sessionId);

    // Clear session cookie after successful signin since user is now authenticated
    if (sessionId) {
      this.sessionCookieService.clearSessionCookie(res, 'sessionId', req);
    }

    this.sessionCookieService.setSessionCookie(
      res,
      result?.accessToken,
      'accessToken',
      req,
    );
    this.sessionCookieService.setSessionCookie(
      res,
      result?.refreshToken,
      'refreshToken',
      req,
    );
    this.sessionCookieService.setSessionCookie(
      res,
      result?.activeProfile?.type,
      'activeProfileType',
      req,
    );
    return result;
  }

  @Post('refresh-token')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Refreshed successful' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const refreshToken = this.sessionCookieService.getSessionId(
      req,
      'refreshToken',
    );

    const result = await this.authService.refreshAccessToken(refreshToken);
    this.sessionCookieService.setSessionCookie(
      res,
      result?.accessToken,
      'accessToken',
      req,
    );
    this.sessionCookieService.setSessionCookie(
      res,
      result?.refreshToken,
      'refreshToken',
      req,
    );
    //TODO: set active profile type in cookie
    // this.sessionCookieService.setSessionCookie(
    //   res,
    //   result?.activeProfile?.type,
    //   'activeProfileType',
    // );
    return result;
  }

  @Post('logout')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Logged out successful' })
  logout(
    @AuthUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    this.sessionCookieService.clearSessionCookie(res, 'sessionId', req);
    this.sessionCookieService.clearSessionCookie(res, 'accessToken', req);
    this.sessionCookieService.clearSessionCookie(res, 'refreshToken', req);
    this.sessionCookieService.clearSessionCookie(res, 'activeProfileType', req);
    return this.authService.logout(user);
  }
}
