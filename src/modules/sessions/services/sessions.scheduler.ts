import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { MailService } from 'src/mail/services/mail.service';
import { SessionStatus } from 'generated/prisma/enums';
import { addHours } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

@Injectable()
export class SessionsScheduler {
  private readonly logger = new Logger(SessionsScheduler.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private mailService: MailService,
  ) {}

  /**
   * Send reminder emails 24 hours before sessions
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async send24HourReminders() {
    this.logger.log('Checking for sessions 24 hours from now...');

    try {
      const now = new Date();
      const in24Hours = addHours(now, 24);
      const in25Hours = addHours(now, 25);

      // Find sessions scheduled between 24-25 hours from now
      const sessionsDueIn24Hours =
        await this.prismaService.tenancy.session.findMany({
          where: {
            scheduledDate: {
              gte: in24Hours,
              lt: in25Hours,
            },
            status: {
              in: [SessionStatus.PENDING, SessionStatus.PENDING_APPROVAL],
            },
            deleted: false,
          },
          include: {
            client: {
              include: {
                userProfile: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
            consultant: {
              include: {
                userProfile: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

      this.logger.log(
        `Found ${sessionsDueIn24Hours.length} sessions due in 24 hours`,
      );

      for (const session of sessionsDueIn24Hours) {
        await this.sendReminderEmail(session, '24hours');
      }
    } catch (error) {
      this.logger.error(
        `Error sending 24-hour reminders: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send reminder emails 1 hour before sessions
   * Runs every 15 minutes
   */
  @Cron('*/15 * * * *') // Every 15 minutes
  async send1HourReminders() {
    this.logger.log('Checking for sessions 1 hour from now...');

    try {
      const now = new Date();
      const in1Hour = addHours(now, 1);
      const in75Minutes = addHours(now, 75 / 60); // 1.25 hours = 75 minutes

      // Find sessions scheduled between 1-1.25 hours from now
      const sessionsDueIn1Hour =
        await this.prismaService.tenancy.session.findMany({
          where: {
            scheduledDate: {
              gte: in1Hour,
              lt: in75Minutes,
            },
            status: {
              in: [SessionStatus.PENDING, SessionStatus.PENDING_APPROVAL],
            },
            deleted: false,
          },
          include: {
            client: {
              include: {
                userProfile: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
            consultant: {
              include: {
                userProfile: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

      this.logger.log(
        `Found ${sessionsDueIn1Hour.length} sessions due in 1 hour`,
      );

      for (const session of sessionsDueIn1Hour) {
        await this.sendReminderEmail(session, '1hour');
      }
    } catch (error) {
      this.logger.error(
        `Error sending 1-hour reminders: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Helper method to send reminder email
   */
  private async sendReminderEmail(
    session: any,
    reminderType: '24hours' | '1hour',
  ) {
    try {
      const clientEmail = session.client?.userProfile?.user?.email;
      const clientFirstName =
        session.client?.userProfile?.user?.firstName || 'Customer';
      const clientLastName = session.client?.userProfile?.user?.lastName || '';

      const consultantEmail = session.consultant?.userProfile?.user?.email;
      const consultantFirstName =
        session.consultant?.userProfile?.user?.firstName || 'Consultant';
      const consultantLastName =
        session.consultant?.userProfile?.user?.lastName || '';

      if (!clientEmail || !consultantEmail) {
        this.logger.warn(
          `Missing email for session ${session.id}. Client: ${clientEmail}, Consultant: ${consultantEmail}`,
        );
        return;
      }

      const timezone = session.clientTimezone || 'Africa/Lagos';
      const sessionDate = new Date(session.scheduledDate);
      const formattedDate = formatInTimeZone(
        sessionDate,
        timezone,
        'EEEE, MMMM d, yyyy h:mm a',
      );

      // Check if reminder has already been sent (using metadata or activity log)
      // For simplicity, we'll just send the reminder - in production, track sent reminders

      // Send email to client
      try {
        await this.mailService.sessionReminder({
          to: clientEmail,
          context: {
            firstName: clientFirstName,
            lastName: clientLastName,
            consultantName:
              `${consultantFirstName} ${consultantLastName}`.trim(),
            sessionDate: formattedDate,
            meetingUrl: session.meetingUrl || 'Meeting link will be provided',
            reminderType,
            is24HourReminder: reminderType === '24hours',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
          },
        });

        this.logger.log(
          `${reminderType} reminder sent to client ${clientEmail} for session ${session.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send ${reminderType} reminder to client: ${error.message}`,
        );
      }

      // Send email to consultant
      try {
        await this.mailService.sessionReminderConsultant({
          to: consultantEmail,
          context: {
            firstName: consultantFirstName,
            lastName: consultantLastName,
            clientName: `${clientFirstName} ${clientLastName}`.trim(),
            sessionDate: formattedDate,
            meetingUrl: session.meetingUrl || 'Meeting link will be provided',
            reminderType,
            is24HourReminder: reminderType === '24hours',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
          },
        });

        this.logger.log(
          `${reminderType} reminder sent to consultant ${consultantEmail} for session ${session.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send ${reminderType} reminder to consultant: ${error.message}`,
        );
      }

      // Record reminder in session activity
      try {
        await this.prismaService.tenancy.sessionActivity.create({
          data: {
            id: `reminder-${Date.now()}-${session.id}`,
            sessionId: session.id,
            activityType: `REMINDER_${reminderType.toUpperCase()}`,
            metadata: {
              sentAt: new Date().toISOString(),
              reminderType,
            },
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to record reminder activity for session ${session.id}: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending reminder email for session ${session.id}: ${error.message}`,
        error.stack,
      );
    }
  }
}
