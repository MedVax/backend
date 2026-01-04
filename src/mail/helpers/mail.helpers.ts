import { ISendMailOptions } from '@nestjs-modules/mailer';

export enum MailPriority {
  Default = 1,
  Increased = 2,
}

export type MailParams<T = { [key: string]: string }> = ISendMailOptions & {
  templateId?: string;
  context?: T;
};
