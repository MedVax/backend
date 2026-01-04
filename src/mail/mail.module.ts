import { Module } from '@nestjs/common';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailProcessor } from './mail.processor';
import * as queueName from 'constants/queue.constant';
import * as env from 'constants/env.constant';

import { MailerModule, MailerOptions } from '@nestjs-modules/mailer';
import { BullModule } from '@nestjs/bullmq';
import { SMTPMailService } from './services/smtp.service';
import { MailService } from './services/mail.service';
import { join } from 'path';

@Module({
  imports: [
    BullModule.registerQueue({ name: queueName.EMAIL }),
    MailerModule.forRootAsync({
      useFactory: async () => {
        return {
          transport: {
            host: env.SMTP_HOST,
            port: 465,
            // ignoreTLS: true,
            secure: true,
            auth: {
              user: env.SMTP_USER,
              pass: env.SMTP_PASSWORD,
            },
          },
          defaults: {
            from: `"Support at Medvax" ${env.EMAIL_FROM}`,
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
          options: {
            partials: {
              dir: join(__dirname, 'templates', 'partials'),
              options: {
                strict: true,
              },
            },
          },
        } as MailerOptions;
      },
    }),
  ],
  controllers: [],
  providers: [MailService, MailProcessor, SMTPMailService],
  exports: [MailService, BullModule],
})
export class MailModule {}
