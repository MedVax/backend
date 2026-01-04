/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { MailerService } from '@nestjs-modules/mailer';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MailParams } from '../helpers/mail.helpers';
import { EMAIL_FROM, IS_PRODUCTION } from 'src/constants/env.constant';

@Injectable()
export class SMTPMailService {
  constructor(private smtpMailer: MailerService) {}

  private logger = new Logger(SMTPMailService.name);
  public async sendHTMLEmail(params: MailParams) {
    try {
      const { html, template } = params;

      if (!params.from) {
        params.from = `Medvax <${params?.sender || EMAIL_FROM}>`;
      }

      if (params.subject && !IS_PRODUCTION) {
        params.subject = params.subject + ' (Demo)';
      }

      if (!template && !html) {
        throw new BadRequestException(
          'Please add either a template or the html string',
        );
      }

      this.logger.log(
        `Sending email..., subject: ${params.subject}---- Receivers: ${params.to}`,
      );

      await this.smtpMailer.sendMail({
        ...params,
      });

      this.logger.log(
        `Mail sent successfully, subject: ${params.subject}---- Receivers: ${params.to}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}- ${params.to}`);

      this.logger.error(error);
      return false;
    }
  }
}
