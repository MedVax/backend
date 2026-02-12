import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { MailService } from 'src/mail/services/mail.service';
import { CalendarIntegrationService } from 'modules/calendar-integration/services/calendar-integration.service';
import { CalendarService } from '../services/calendar.service';
import { SessionRescheduleEvent } from '../events/sessions.event';
import { SESSION_EVENTS } from '../constants/sessions.constant';
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';

@Injectable()
export class SessionRescheduleNotificationListener {
  private logger = new Logger(SessionRescheduleNotificationListener.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private mailService: MailService,
    @Inject(forwardRef(() => CalendarIntegrationService))
    private calendarIntegrationService: CalendarIntegrationService,
    private calendarService: CalendarService,
  ) {}

  @OnEvent(SESSION_EVENTS.SESSION_RESCHEDULE_NOTIFICATION)
  async handleSessionRescheduleEvent(event: SessionRescheduleEvent) {
    this.logger.log(
      `Handling SESSION_RESCHEDULE_NOTIFICATION event for session ${event.sessionId}`,
    );

    try {
      const {
        sessionId,
        previousDate,
        newDate,

        reason,
      } = event;

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

      const timezone = session.clientTimezone || 'Africa/Lagos';
      const previousDateFormatted = formatInTimeZone(
        previousDate,
        timezone,
        'EEEE, MMMM d, yyyy h:mm a',
      );
      const newDateFormatted = formatInTimeZone(
        newDate,
        timezone,
        'EEEE, MMMM d, yyyy h:mm a',
      );

      // Send email to client
      if (clientEmail) {
        try {
          await this.mailService.sessionRescheduled({
            to: clientEmail,
            context: {
              firstName: clientFirstName,
              lastName: clientLastName,
              consultantName:
                `${consultantFirstName} ${consultantLastName}`.trim(),
              previousDate: previousDateFormatted,
              newDate: newDateFormatted,
              meetingUrl: session.meetingUrl,
              reason: reason || 'Rescheduled by client',
              supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
            },
          });

          this.logger.log(
            `Session reschedule email sent to client ${clientEmail}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send reschedule email to client: ${error.message}`,
          );
        }
      }

      // Send email to consultant
      if (consultantEmail) {
        try {
          await this.mailService.sessionRescheduledConsultant({
            to: consultantEmail,
            context: {
              firstName: consultantFirstName,
              lastName: consultantLastName,
              clientName: `${clientFirstName} ${clientLastName}`.trim(),
              previousDate: previousDateFormatted,
              newDate: newDateFormatted,
              meetingUrl: session.meetingUrl,
              reason: reason || 'Rescheduled by client',
              supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
            },
          });

          this.logger.log(
            `Session reschedule notification sent to consultant ${consultantEmail}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send reschedule notification to consultant: ${error.message}`,
          );
        }
      }

      // Update calendar event if calendar is connected
      const consultantUser = session.consultant?.userProfile?.user;
      if (consultantUser) {
        try {
          // Get calendar integration
          const calendarIntegrations =
            await this.calendarIntegrationService.getIntegration(
              consultantUser.id,
              'google',
            );

          const calendarIntegration = Array.isArray(calendarIntegrations)
            ? calendarIntegrations.find(
                (ci) => ci.isConnected && ci.provider === 'google',
              )
            : calendarIntegrations;

          if (calendarIntegration) {
            const calendarCredentials =
              await this.calendarIntegrationService.getCredentials(
                consultantUser.id,
                'google',
              );

            if (calendarCredentials) {
              // Get calendar event ID from session (prefer direct field, fallback to metadata for backward compatibility)
              const calendarEventId =
                (session as any).calendarEventId ||
                ((session.metadata as Record<string, any>) || {})
                  .calendarEventId;

              if (calendarEventId) {
                // Update existing calendar event (1:1 relationship - one session = one event)
                const newSessionDate = new Date(newDate);
                const newSessionEndDate = addMinutes(newSessionDate, 60); // 1 hour session

                const success = await this.calendarService.updateEvent(
                  calendarCredentials,
                  calendarEventId,
                  {
                    start: {
                      dateTime: newSessionDate.toISOString(),
                      timeZone: session.clientTimezone || 'Africa/Lagos',
                    },
                    end: {
                      dateTime: newSessionEndDate.toISOString(),
                      timeZone: session.clientTimezone || 'Africa/Lagos',
                    },
                    description: `Session with ${clientFirstName} ${clientLastName}\n\nSession Type: ${session.sessionType}\nMeeting Link: ${session.meetingUrl || 'TBD'}\n\nRescheduled from ${formatInTimeZone(
                      previousDate,
                      session.clientTimezone || 'Africa/Lagos',
                      'EEEE, MMMM d, yyyy h:mm a',
                    )}`,
                    conferenceData: session.meetingUrl
                      ? {
                          entryPoints: [
                            {
                              entryPointType: 'video',
                              uri: session.meetingUrl,
                              label: 'Join Meeting',
                            },
                          ],
                        }
                      : undefined,
                  },
                  'google',
                );

                if (success) {
                  // Ensure calendarIntegrationId is set on session
                  const sessionData: any = {};
                  if (!(session as any).calendarIntegrationId) {
                    sessionData.calendarIntegrationId = calendarIntegration.id;
                  }
                  // Ensure calendarEventId is stored in direct field if it was only in metadata
                  if (!(session as any).calendarEventId && calendarEventId) {
                    sessionData.calendarEventId = calendarEventId;
                  }

                  if (Object.keys(sessionData).length > 0) {
                    await this.prismaService.tenancy.session.update({
                      where: { id: sessionId },
                      data: sessionData,
                    });
                  }

                  this.logger.log(
                    `Calendar event updated for session ${sessionId}: ${calendarEventId}`,
                  );
                } else {
                  this.logger.warn(
                    `Failed to update calendar event ${calendarEventId} for session ${sessionId}`,
                  );
                }
              } else {
                this.logger.warn(
                  `No calendar event ID found for session ${sessionId}. Calendar event should have been created during session creation.`,
                );
              }
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to update calendar event for rescheduled session: ${error.message}`,
          );
          // Don't throw - calendar update failure shouldn't break reschedule
        }
      }
    } catch (error) {
      this.logger.error(
        `Error handling SESSION_RESCHEDULE_NOTIFICATION event: ${error.message}`,
        error.stack,
      );
    }
  }
}
