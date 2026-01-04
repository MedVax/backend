import { ApiTags } from '@nestjs/swagger';
import { Body, Controller, Headers, HttpStatus, Post } from '@nestjs/common';

import { AuthAllow } from 'metadatas/auth-allow.metadata';
import { Response } from 'metadatas/response.metadata';
import { UserSigninDto } from '../dtos/user-signin.dto';
import { UserRefreshTokenDto } from '../dtos/user-refresh-token.dto';
import { AuthService } from '../services/auth.service';
import { VerifyOtpDTO } from '../dtos/verify-otp.dto';
import { SendVerifyOtpDTO } from '../dtos/send-verify-otp.dto';
import { UserSignupDto } from '../dtos/user-signup';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Account Created successful' })
  signupUser(@Body() dto: UserSignupDto) {
    return this.authService.signup(dto);
  }

  @Post('/signup/validate-email-otp')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Verified successful' })
  verifyEmailWithOtp(@Body() dto: VerifyOtpDTO) {
    return this.authService.verifyEmailWithOTP(dto);
  }

  @Post('/signup/verify-email')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'OTP sent successful' })
  sendVerifyOtp(@Body() dto: SendVerifyOtpDTO) {
    return this.authService.sendVerificationOTP(dto);
  }

  @Post('signin')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Signin successful' })
  signinUser(@Body() dto: UserSigninDto) {
    return this.authService.signin(dto);
  }

  @Post('signin/admin')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Signin successful' })
  signinUserAdmin(@Body() dto: UserSigninDto) {
    return this.authService.adminSignin(dto);
  }

  @Post('refresh-token')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Refreshed successful' })
  refreshToken(@Body() dto: UserRefreshTokenDto) {
    const { refreshToken } = dto;
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Post('logout')
  @AuthAllow()
  @Response({ status: HttpStatus.OK, message: 'Logged out successful' })
  logout(
    @AuthUser() user: User,
    @Headers('authorization') authorization: Headers,
  ) {
    return this.authService.logout(
      user,
      authorization.get('authorization')?.split(' ')[1] || '',
    );
  }
}
