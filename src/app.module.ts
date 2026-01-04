import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as redisStore from 'cache-manager-redis-store';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  IS_PRODUCTION,
  JWT_EXPIRATION,
  JWT_SECRET,
  LOGTAIL_SOURCE_TOKEN,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from './constants/env.constant';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { arrayToObject } from 'utils/object-util';
import { PermissionsModule } from 'modules/permissions/permissions.module';
import { AppGlobalModule } from './app-global.module';
import { RolesModule } from 'modules/roles/roles.module';
import { UserModule } from './modules/user/user.module';
import { PrismaTenancyModule } from 'modules/prisma-tenancy/prisma-tenancy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        // 20 request/sec
        name: 'short',
        ttl: 1000,
        limit: 20,
      },
      {
        // 30 requests for half a minutes
        name: 'medium',
        ttl: 30000,
        limit: 500,
      },
      {
        // 600 requests/minutes
        name: 'extended',
        ttl: 60000,
        limit: 1000,
      },
    ]),
    JwtModule.register({
      global: true,
      secret: JWT_SECRET,
      signOptions: { expiresIn: JWT_EXPIRATION },
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore as any,

      host: REDIS_HOST,
      port: REDIS_PORT,
      ...(IS_PRODUCTION ? { tls: {} } : {}),
      username: REDIS_USERNAME,
      ...(REDIS_PASSWORD && { password: REDIS_PASSWORD }),
    }),
    BullModule.forRoot({
      connection: {
        ...(IS_PRODUCTION ? { tls: {} } : {}),
        host: REDIS_HOST,
        port: Number(REDIS_PORT),
        password: REDIS_PASSWORD,
        connectTimeout: 30000,
      },
    }),
    ScheduleModule.forRoot(),
    ClsModule.forRoot({
      global: true,
    }),
    LoggerModule.forRootAsync({
      useFactory: (): { pinoHttp: any } => {
        const transports: any = {
          targets: [
            {
              level: 'info',
              target: 'pino-pretty',
              options: {
                singleLine: true,
              },
            },
          ],
        };

        if (LOGTAIL_SOURCE_TOKEN) {
          const logtailTransport = {
            level: 'info',
            target: '@logtail/pino',
            options: {
              sourceToken: LOGTAIL_SOURCE_TOKEN,
              singleLine: true,
            },
          };

          transports.targets.push(logtailTransport);
        }

        return {
          pinoHttp: {
            ...(IS_PRODUCTION ? { autoLogging: true } : { autoLogging: false }),
            genReqId: () => randomUUID(),
            customProps: (req: Request, res: Response) => {
              const { ip, method, originalUrl } = req as unknown as Request;
              const userAgent = req.get('user-agent') || '';

              const requestClone = { ...req };

              const userData = arrayToObject(requestClone?.rawHeaders);
              const authUser = requestClone?.authUser as unknown as any;

              if (userData && userData['Authorization']) {
                userData['Authorization'] = '********';
              }

              if (userData && userData['x-api-key']) {
                userData['x-api-key'] = '*******';
              }

              if (authUser && authUser['password']) {
                authUser['password'] = '*******';
              }

              // if (authUser && authUser['email']) {
              //   authUser['email'] = '*******';
              // }

              return {
                req: requestClone,
                status: (res as unknown as Response)?.status,
                ...(LOGTAIL_SOURCE_TOKEN
                  ? { userData, authUser, userAgent, ip, method, originalUrl }
                  : {}),
              };
            },
            transport: transports,
          },
        };
      },
    }),
    EventEmitterModule.forRoot({ wildcard: true }),

    RolesModule,
    PermissionsModule,
    UserModule,
    AppGlobalModule,
    PrismaTenancyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
