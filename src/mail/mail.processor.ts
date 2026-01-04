import * as queueName from 'src/constants/queue.constant';
import { MailParams } from './helpers/mail.helpers';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SMTPMailService } from './services/smtp.service';
import { SEND_EMAIL } from './constants';

@Processor(queueName.EMAIL)
export class MailProcessor extends WorkerHost {
  private logger = new Logger(MailProcessor.name);

  constructor(private smtpMailer: SMTPMailService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { data } = job;

    this.logger.log(`process mail: ${JSON.stringify(data)}`);

    switch (job.name) {
      case SEND_EMAIL:
        await this.sendMail(job);
        break;
      default:
        break;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<MailParams>) {
    const { data } = job;

    // Log job completion status
    this.logger.log(`Queued Active mail: ${data?.subject} - ${data?.to}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<MailParams>) {
    const { data } = job;

    this.logger.log(`Queued completed mail: ${data?.subject} - ${data?.to}`);
  }

  private async sendMail(job: Job<MailParams>) {
    try {
      const { data } = job;

      this.logger.log(`Sending Mail: ${data?.subject} - ${data?.to}`);
      const response = await this.smtpMailer.sendHTMLEmail({ ...data });

      if (!response) {
        throw new Error(`SMTP failed to send`);
      }
    } catch (error) {
      this.logger.error(`Mail Error - ${JSON.stringify(error)}`);
      if (job.attemptsMade < 5) {
        await job.retry();
      } else {
        this.logger.log(
          `Failed to send mail ${job.data.subject}. SMTP retry timedout after ${job.attemptsMade} retries`,
        );
      }
    }
  }
}
