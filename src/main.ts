import { NestFactory, Reflector } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerDocumentOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import 'dotenv/config';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from 'filters/http-exception-fliter';
import { AuthGuard } from './guards/auth.guard';
import { CORS_ORIGIN, IS_DEVELOPMENT } from 'constants/env.constant';
import compression from 'compression';

async function bootstrap() {
  process.env.TZ = 'Africa/Lagos'; // Set default timezone

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const logger = app.get(Logger);

  // Trust proxy for DigitalOcean load balancer/reverse proxy
  // This allows the app to correctly detect HTTPS from X-Forwarded-Proto header
  // app.set('trust proxy', true);

  app.useBodyParser('json', { limit: '10mb' });
  app.use(cookieParser());

  // Configure body parser for file uploads
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });
  app.use(compression());

  // logger
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: CORS_ORIGIN?.split(','),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  app.useGlobalGuards(new AuthGuard(app.get(Reflector)));
  app.useLogger(logger);
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        exposeDefaultValues: true,
        exposeUnsetFields: false,
      },
      enableDebugMessages: IS_DEVELOPMENT,
      whitelist: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Medvax API')
    .setDescription(
      'Medvax API allows you to find people in various databases.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag(
      'Medvax',
      'Medvax API allows you to find people in various databases.',
    )
    .addSecurityRequirements('bearer')
    .build();

  // For example, if you want to make sure that the
  // library generates operation names like createUser
  // instead of UsersController_createUser, you can set the following:
  const options: SwaggerDocumentOptions = {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  };
  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, options);
  SwaggerModule.setup('api/v1/docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
