import { Injectable, Logger } from '@nestjs/common';
import * as queueName from 'src/constants/queue.constant';
import { MailParams } from '../helpers/mail.helpers';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SEND_EMAIL } from '../constants';
import { Optional } from 'src/types/index.types';

@Injectable()
export class MailService {
  constructor(@InjectQueue(queueName.EMAIL) private emailQueue: Queue) {}

  private logger = new Logger(this.constructor.name);

  public async sendMail<T>(params: MailParams<T>): Promise<void> {
    const { to, cc, subject } = params;

    // Helper to safely stringify email addresses
    function formatAddress(
      address: string | { address: string } | undefined,
    ): string {
      if (!address) return 'N/A';
      if (typeof address === 'string') return address;
      if (
        typeof address === 'object' &&
        'address' in address &&
        typeof address.address === 'string'
      ) {
        return address.address;
      }
      return JSON.stringify(address);
    }

    // Helper to handle array or single for "to"/"cc"
    function formatAddresses(
      addresses:
        | string
        | { address: string }
        | Array<string | { address: string }>
        | undefined,
    ): string {
      if (!addresses) return 'N/A';
      if (Array.isArray(addresses)) {
        return addresses.map(formatAddress).join(', ');
      }
      return formatAddress(addresses);
    }

    this.logger.log(
      `Message Queued Successfully: ${formatAddresses(to)} - ${subject} - cc:${formatAddresses(cc)}`,
    );
    await this.emailQueue.add(SEND_EMAIL, params, { removeOnComplete: true });
  }

  async forgotPassword(
    params: Optional<
      MailParams<{
        firstName: string;
        forgotPasswordLink: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Password Reset',
      template: 'forgot-password',
      ...params,
    });
  }

  async sendVerificationOTP(
    params: Optional<
      MailParams<{
        otp: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'OTP Verification',
      template: 'verification-otp',
      ...params,
    });
  }

  async forgotPasswordSuccessful(
    params: Optional<
      MailParams<{
        firstName: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Password Reset Successful',
      template: 'forgot-password-successful',
      ...params,
    });
  }

  async signInSuccessful(
    params: Optional<
      MailParams<{
        firstName: string;
        loggedInTime: string;
        userAgent: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Login Successful!',
      template: 'login-successful',
      ...params,
    });
  }

  async accountCreated(
    params: Optional<
      MailParams<{
        firstName: string;
        orgName: string;
        userType: string;
        loginUrl: string;
        email: string;
        password: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Welcome to our platform!',
      template: 'user-created',
      ...params,
    });
  }

  async userInvited(
    params: Optional<
      MailParams<{
        invitedBy: string;
        inviteLink: string;
        organizationName: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Accept Invite',
      template: 'user-invited',
      ...params,
    });
  }

  async userInvitationAccepted(
    params: Optional<
      MailParams<{
        firstName: string;
        organizationName: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Invitation Accepted',
      template: 'user-invitation-accepted',
      ...params,
    });
  }

  async backgroundProcessConfirmation(
    params: Optional<
      MailParams<{
        firstName: string;
        link: string;
        jobId: string;
        jobName: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: `Background Process ${params.context.jobId} Completed successfully!`,
      template: 'background-process-confirmation',
      ...params,
    });
  }

  async topupPaymentSuccess(
    params: Optional<
      MailParams<{
        firstName: string;
        orgName: string;
        loginUrl: string;
        supportEmail: string;
        amount: string;
        credit: number;
        creditBalance: number;
        date: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Your Credit Has Been Topped Up Successfully',
      template: 'payment-topup-success',
      ...params,
    });
  }

  async topupPaymentFailed(
    params: Optional<
      MailParams<{
        firstName: string;
        orgName: string;
        loginUrl: string;
        supportEmail: string;
        amount: string;
        failureReason: string;
        date: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Top-Up Attempt Unsuccessful',
      template: 'payment-topup-failed',
      ...params,
    });
  }

  async planPaymentSuccess(
    params: Optional<
      MailParams<{
        firstName: string;
        orgName: string;
        loginUrl: string;
        supportEmail: string;
        amount: string;
        frequency: string;
        startDate: string;
        endDate: string;
        credit: number;
        date: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Custom Plan Confirmation',
      template: 'payment-plan-success',
      ...params,
    });
  }

  async customPlanRequest(
    params: Optional<
      MailParams<{
        firstName: string;
        orgName: string;
        email: string;
        message: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Custom Plan Request',
      template: 'plan-custom-request',
      ...params,
    });
  }

  async planCreditInsufficient(
    params: Optional<
      MailParams<{
        loginUrl: string;
        firstName: string;
        orgName: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Alert: Plan Threshold Exceeded',
      template: 'plan-credit-insufficient',
      ...params,
    });
  }

  async creditInsufficient(
    params: Optional<
      MailParams<{
        loginUrl: string;
        firstName: string;
        orgName: string;
        requiredCredit: number;
        availableCredit: number;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Insufficient Credit',
      template: 'credit-insufficient',
      ...params,
    });
  }

  async creditLowThreshold(
    params: Optional<
      MailParams<{
        loginUrl: string;
        firstName: string;
        orgName: string;
        creditBalance: number;
        creditThreshold: number;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Low Credit Alert: Time to Top Up',
      template: 'credit-low-threshold',
      ...params,
    });
  }
}
