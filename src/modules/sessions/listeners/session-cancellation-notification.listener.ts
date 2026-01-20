import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { MailService } from 'src/mail/services/mail.service';
import { SessionCancellationEvent } from '../events/sessions.event';
import { SESSION_EVENTS } from '../constants/sessions.constant';
import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';

@Injectable()
export class SessionCancellationNotificationListener {
  private logger = new Logger(SessionCancellationNotificationListener.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private mailService: MailService,
  ) {}

  @OnEvent(SESSION_EVENTS.SESSION_CANCELLATION_NOTIFICATION)
  async handleSessionCancellationEvent(event: SessionCancellationEvent) {
    this.logger.log(
      `Handling SESSION_CANCELLATION_NOTIFICATION event for session ${event.sessionId}`,
    );

    try {
      const { sessionId, reason } = event;

      // Get session details
      const session = await this.prismaService.tenancy.session.findUnique({
        where: { id: sessionId },
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

      if (!session) {
        this.logger.error(`Session ${sessionId} not found`);
        return;
      }

      const clientEmail = session.client?.userProfile?.user?.email;
      const clientFirstName =
        session.client?.userProfile?.user?.firstName || 'Customer';
      const clientLastName = session.client?.userProfile?.user?.lastName || '';

      const consultantEmail = session.consultant?.userProfile?.user?.email;
      const consultantFirstName =
        session.consultant?.userProfile?.user?.firstName || 'Consultant';
      const consultantLastName =
        session.consultant?.userProfile?.user?.lastName || '';

      const sessionDate = new Date(session.scheduledDate);
      const formattedDate = session.clientTimezone
        ? formatInTimeZone(
            sessionDate,
            session.clientTimezone,
            'EEEE, MMMM d, yyyy h:mm a',
          )
        : format(sessionDate, 'EEEE, MMMM d, yyyy h:mm a');

      // Send email to client
      if (clientEmail) {
        try {
          await this.mailService.sessionCancelled({
            to: clientEmail,
            context: {
              firstName: clientFirstName,
              lastName: clientLastName,
              consultantName:
                `${consultantFirstName} ${consultantLastName}`.trim(),
              sessionDate: formattedDate,
              reason: reason || 'No reason provided',
              supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
            },
          });

          this.logger.log(
            `Session cancellation email sent to client ${clientEmail}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send cancellation email to client: ${error.message}`,
          );
        }
      }

      // Send email to consultant
      if (consultantEmail) {
        try {
          await this.mailService.sessionCancelledConsultant({
            to: consultantEmail,
            context: {
              firstName: consultantFirstName,
              lastName: consultantLastName,
              clientName: `${clientFirstName} ${clientLastName}`.trim(),
              sessionDate: formattedDate,
              reason: reason || 'Cancelled by client',
              supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
            },
          });

          this.logger.log(
            `Session cancellation notification sent to consultant ${consultantEmail}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send cancellation notification to consultant: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error handling SESSION_CANCELLATION_NOTIFICATION event: ${error.message}`,
        error.stack,
      );
    }
  }
}
