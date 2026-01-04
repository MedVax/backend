import { ClassSerializerInterceptor, Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './guards/auth.guard';
import { MailService } from './mail/services/mail.service';
import { BullModule } from '@nestjs/bullmq';
import { MailModule } from './mail/mail.module';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { OtpService } from 'services/otp.service';
import { TokenService } from 'services/token.service';
import { AvatarService } from 'services/avatar.service';
import { AuthModule } from './modules/auth/auth.module';
import { BcryptService } from 'services/bcrypt.service';
import { HttpModule } from '@nestjs/axios';
import { RedisService } from 'services/redis.service';
import { AesEncryptionService } from 'services/aesEcryption.service';
import { PermissionsGuard } from './guards/permission.guard';
import { UploadsService } from './uploads/uploads.service';
import { UploadsModule } from './uploads/uploads.module';
import { DigitalOceanService } from 'modules/services/digital-ocean.service';

const providers = [
  OtpService,
  MailService,
  TokenService,
  AvatarService,
  BcryptService,
  BullModule,
  RedisService,
  AesEncryptionService,
  UploadsService,
  DigitalOceanService,
  AvatarService,
];

@Global()
@Module({
  imports: [MailModule, AuthModule, HttpModule, UploadsModule],
  providers: [
    ...providers,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [...providers],
})
export class AppGlobalModule {}
