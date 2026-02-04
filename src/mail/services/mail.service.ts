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

  async recurringOrderReminder(
    params: Optional<
      MailParams<{
        firstName: string;
        orderId: string;
        nextDeliveryDate: string;
        itemsSummary: string;
        totalAmount: string;
        frequency: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Reminder: Your Recurring Order is Due Tomorrow',
      template: 'recurring-order-reminder',
      ...params,
    });
  }

  async recurringPaymentFailure(
    params: Optional<
      MailParams<{
        firstName: string;
        orderId: string;
        orderDate: string;
        retryCount: number;
        maxRetries: number;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Payment Failed for Your Recurring Order',
      template: 'recurring-payment-failure',
      ...params,
    });
  }

  async recurringOrderCancelled(
    params: Optional<
      MailParams<{
        firstName: string;
        orderId: string;
        orderDate: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Your Recurring Order Has Been Cancelled',
      template: 'recurring-order-cancelled',
      ...params,
    });
  }

  async orderPaymentConfirmed(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        orderId: string;
        orderDate: string;
        itemsSummary: string;
        totalAmount: string;
        paymentReference: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Payment Confirmed - Your Order Has Been Received',
      template: 'order-payment-confirmed',
      ...params,
    });
  }

  async recurringOrderCreated(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        orderId: string;
        frequency: string;
        nextDeliveryDate: string;
        itemsSummary: string;
        totalAmount: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Your Recurring Order Has Been Set Up',
      template: 'recurring-order-created',
      ...params,
    });
  }

  async orderStatusUpdated(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        orderId: string;
        previousOrderStatus: string;
        newOrderStatus: string;
        previousPaymentStatus: string;
        newPaymentStatus: string;
        itemsSummary: string;
        totalAmount: string;
        orderDate: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Your Order Status Has Been Updated',
      template: 'order-status-updated',
      ...params,
    });
  }

  async sessionBooked(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        consultantName: string;
        sessionDetails: Array<{
          date: string;
          meetingUrl?: string;
          meetingId?: string;
        }>;
        sessionType: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Your Session Has Been Booked',
      template: 'session-booked',
      ...params,
    });
  }

  async sessionBookedConsultant(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        clientName: string;
        sessionDetails: Array<{
          date: string;
          meetingUrl?: string;
          meetingId?: string;
        }>;
        sessionType: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'New Session Booked',
      template: 'session-booked-consultant',
      ...params,
    });
  }

  async sessionCancelled(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        consultantName: string;
        sessionDate: string;
        reason: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Session Cancelled',
      template: 'session-cancelled',
      ...params,
    });
  }

  async sessionCancelledConsultant(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        clientName: string;
        sessionDate: string;
        reason: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Session Cancelled by Client',
      template: 'session-cancelled-consultant',
      ...params,
    });
  }

  async sessionRescheduled(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        consultantName: string;
        previousDate: string;
        newDate: string;
        meetingUrl?: string;
        reason: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Session Rescheduled',
      template: 'session-rescheduled',
      ...params,
    });
  }

  async sessionRescheduledConsultant(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        clientName: string;
        previousDate: string;
        newDate: string;
        meetingUrl?: string;
        reason: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: 'Session Rescheduled',
      template: 'session-rescheduled-consultant',
      ...params,
    });
  }

  async sessionInvitation(
    params: Optional<
      MailParams<{
        name: string;
        sessionDate: string;
        consultantName: string;
        meetingUrl?: string;
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: "You've Been Invited to a Session",
      template: 'session-invitation',
      ...params,
    });
  }

  async sessionReminder(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        consultantName: string;
        sessionDate: string;
        meetingUrl: string;
        reminderType: '24hours' | '1hour';
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject:
        params.context.reminderType === '24hours'
          ? 'Session Reminder - Your Session is Tomorrow'
          : 'Session Reminder - Your Session is in 1 Hour',
      template: 'session-reminder',
      ...params,
    });
  }

  async consultantAccountCreated(
    params: MailParams<{
      firstName: string;
      lastName?: string;
      email: string;
      password: string;
      loginUrl: string;
      supportEmail: string;
    }>,
  ): Promise<void> {
    await this.sendMail({
      ...params,
      subject:
        params.subject ||
        'Welcome to Medvax - Your Consultant Account is Ready!',
      template: 'consultant-account-created',
    });
  }

  async sessionReminderConsultant(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        clientName: string;
        sessionDate: string;
        meetingUrl: string;
        reminderType: '24hours' | '1hour';
        supportEmail: string;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject:
        params.context.reminderType === '24hours'
          ? 'Session Reminder - Session Tomorrow'
          : 'Session Reminder - Session in 1 Hour',
      template: 'session-reminder-consultant',
      ...params,
    });
  }

  async prescriptionNoteAdded(
    params: Optional<
      MailParams<{
        firstName: string;
        lastName?: string;
        consultantName: string;
        sessionDate: string;
        sessionId: string;
        prescriptionNote: string;
        isFirstTime: boolean;
      }>,
      'subject'
    >,
  ) {
    return this.sendMail({
      subject: params.context.isFirstTime
        ? 'Prescription Note Added to Your Session'
        : 'Prescription Note Updated for Your Session',
      template: 'prescription-note-added',
      ...params,
    });
  }
}
