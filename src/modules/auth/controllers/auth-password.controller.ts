import { Body, Controller, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { User } from 'generated/prisma/client';

import { AuthAllow } from 'metadatas/auth-allow.metadata';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import { UserPasswordChangeDto } from '../dtos/user-password-change.dto';
import { UserPasswordResetDto } from '../dtos/user-password-reset.dto';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { AuthPasswordService } from '../services/auth-password.service';
import { ForgotPasswordDto } from '../dtos/forgot-password';

@Controller('auth/password')
@ApiTags('Auth')
export class AuthPasswordController {
  constructor(private authPasswordService: AuthPasswordService) {}

  @Post('forgot')
  @AuthAllow()
  @Response({
    status: HttpStatus.OK,
    message: 'Password reset request sent successful',
  })
  requestPasswordReset(@Body() dto: ForgotPasswordDto) {
    return this.authPasswordService.forgot(dto?.email);
  }

  @Put('reset')
  @AuthAllow()
  @Response({
    status: HttpStatus.OK,
    message: 'Password reset successful',
    data: undefined,
  })
  resetPassword(@Body() dto: UserPasswordResetDto) {
    return this.authPasswordService.reset(dto);
  }

  @Put('change')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Password changed successful',
  })
  changePassword(@Body() dto: UserPasswordChangeDto, @AuthUser() user: User) {
    return this.authPasswordService.change(user?.id, dto);
  }
}
