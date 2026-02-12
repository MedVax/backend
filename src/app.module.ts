import { MiddlewareConsumer, Module } from '@nestjs/common';
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
  LOGTAIL_INGESTING_HOST,
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
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CartModule } from './modules/cart/cart.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StockModule } from './modules/stock/stock.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ConsultantsModule } from './modules/consultants/consultants.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { CalendarIntegrationModule } from './modules/calendar-integration/calendar-integration.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { BlogModule } from './modules/blog/blog.module';
import { TokenToAuthUserMiddleware } from 'middlewares/token-to-auth-user-middleware';

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
        connectTimeout: IS_PRODUCTION ? 30000 : 5000,
        retryStrategy: (times: number) => {
          if (IS_PRODUCTION) {
            return Math.min(times * 50, 2000);
          }
          return null; // Don't retry in development if connection fails quickly
        },
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
              options: { endpoint: `https://${LOGTAIL_INGESTING_HOST}` },
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

              // Only extract minimal data needed for logging to prevent memory leaks
              // Avoid cloning entire request object which can be large and hold references
              const userData = req.rawHeaders
                ? arrayToObject(req.rawHeaders)
                : {};
              const authUser = req.authUser
                ? {
                    id: (req.authUser as any).id,
                    email: (req.authUser as any).email,
                    type: (req.authUser as any).type,
                  }
                : null;

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
                // Only include minimal request info instead of full clone
                method,
                url: originalUrl,
                status: (res as unknown as Response)?.status,
                ...(LOGTAIL_SOURCE_TOKEN
                  ? { userData, authUser, userAgent, ip }
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
    ClientsModule,
    ConsultantsModule,
    AppGlobalModule,
    PrismaTenancyModule,
    // Ecommerce modules
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    CartModule,
    FavoritesModule,
    AddressesModule,
    OrdersModule,
    PrescriptionsModule,
    PharmacyModule,
    SubscriptionsModule,
    PaymentsModule,
    StockModule,
    SessionsModule,
    TransactionsModule,
    CalendarIntegrationModule,
    MetricsModule,
    BlogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TokenToAuthUserMiddleware).forRoutes('*');
  }
}
