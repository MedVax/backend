import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { MailService } from 'src/mail/services/mail.service';
import { CalendarIntegrationService } from 'modules/calendar-integration/services/calendar-integration.service';
import { CalendarService } from '../services/calendar.service';
import { SessionCreationEvent } from '../events/sessions.event';
import { SESSION_EVENTS } from '../constants/sessions.constant';
import { formatInTimeZone } from 'date-fns-tz';
import { format, addMinutes } from 'date-fns';
import {
  UserProfileClientGetPayload,
  UserProfileConsultantGetPayload,
} from 'generated/prisma/models';

@Injectable()
export class SessionCreatedListener {
  private logger = new Logger(SessionCreatedListener.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private mailService: MailService,
    @Inject(forwardRef(() => CalendarIntegrationService))
    private calendarIntegrationService: CalendarIntegrationService,
    private calendarService: CalendarService,
  ) {}

  @OnEvent(SESSION_EVENTS.SESSION_CREATED)
  async handleSessionCreatedEvent(event: SessionCreationEvent) {
    this.logger.log(
      `Handling SESSION_CREATED event for client ${event.clientUserId}`,
    );

    try {
      const { sessions, clientUserId } = event;

      // Get client details
      const client =
        await this.prismaService.tenancy.userProfileClient.findUnique({
          where: { id: clientUserId },
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
        });

      if (!client) {
        this.logger.error(`Client ${clientUserId} not found`);
        return;
      }

      const firstSession = sessions[0];
      const consultant =
        await this.prismaService.tenancy.userProfileConsultant.findUnique({
          where: { id: firstSession.consultantId },
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
        });

      if (!consultant) {
        this.logger.error(`Consultant ${firstSession.consultantId} not found`);
        return;
      }

      await this.handleMailNotification(event, consultant, client);

      // Update client hasBookedSession flag (already done in service, but ensuring it's set)
      if (!client.hasBookedSession) {
        await this.prismaService.tenancy.userProfileClient.update({
          where: { id: clientUserId },
          data: { hasBookedSession: true },
        });
      }

      // Create calendar events for both consultant and client if calendars are connected
      await this.handleCalendarNotification(event, consultant, client);
    } catch (error) {
      this.logger.error(
        `Error handling SESSION_CREATED event: ${error.message}`,
        error.stack,
      );
    }
  }

  async handleMailNotification(
    event: SessionCreationEvent,
    consultant: UserProfileConsultantGetPayload<{
      include: {
        userProfile: {
          select: {
            user: {
              select: {
                id: true;
                email: true;
                firstName: true;
                lastName: true;
              };
            };
          };
        };
      };
    }>,
    client: UserProfileClientGetPayload<{
      include: {
        userProfile: {
          select: {
            user: {
              select: {
                id: true;
                email: true;
                firstName: true;
                lastName: true;
              };
            };
          };
        };
      };
    }>,
  ) {
    const { dto, sessions } = event;
    // Prepare session details
    const clientEmail = client.userProfile?.user?.email;
    const clientFirstName = client.userProfile?.user?.firstName || 'Customer';
    const clientLastName = client.userProfile?.user?.lastName || '';

    const consultantEmail = consultant.userProfile?.user?.email;
    const consultantFirstName =
      consultant.userProfile?.user?.firstName || 'Consultant';
    const consultantLastName = consultant.userProfile?.user?.lastName || '';

    // Format session dates
    const sessionDetails = sessions.map((session: any) => {
      const date = new Date(session.scheduledDate);
      const formattedDate = session.clientTimezone
        ? formatInTimeZone(
            date,
            session.clientTimezone,
            'EEEE, MMMM d, yyyy h:mm a',
          )
        : format(date, 'EEEE, MMMM d, yyyy h:mm a');

      return {
        date: formattedDate,
        meetingUrl: session.meetingUrl,
        meetingId: session.meetingId,
      };
    });

    // Send email to client
    if (clientEmail) {
      try {
        await this.mailService.sessionBooked({
          to: clientEmail,
          context: {
            firstName: clientFirstName,
            lastName: clientLastName,
            consultantName:
              `${consultantFirstName} ${consultantLastName}`.trim(),
            sessionDetails,
            sessionType: dto.sessionType,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
          },
        });

        this.logger.log(
          `Session booking confirmation email sent to client ${clientEmail}`,
        );
      } catch (error) {
        this.logger.error(`Failed to send email to client: ${error.message}`);
      }
    }

    // Send email to consultant
    if (consultantEmail) {
      try {
        await this.mailService.sessionBookedConsultant({
          to: consultantEmail,
          context: {
            firstName: consultantFirstName,
            lastName: consultantLastName,
            clientName: `${clientFirstName} ${clientLastName}`.trim(),
            sessionDetails,
            sessionType: dto.sessionType,
            multipleSessions: sessionDetails.length > 1,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@medvax.com',
          },
        });

        this.logger.log(
          `Session booking notification email sent to consultant ${consultantEmail}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send email to consultant: ${error.message}`,
        );
      }
    }
  }

  async handleCalendarNotification(
    event: SessionCreationEvent,
    consultant: UserProfileConsultantGetPayload<{
      include: {
        userProfile: {
          select: {
            user: {
              select: {
                id: true;
                email: true;
                firstName: true;
                lastName: true;
              };
            };
          };
        };
      };
    }>,
    client: UserProfileClientGetPayload<{
      include: {
        userProfile: {
          select: {
            user: {
              select: {
                id: true;
                email: true;
                firstName: true;
                lastName: true;
              };
            };
          };
        };
      };
    }>,
  ) {
    const { dto, sessions } = event;
    const consultantUser = consultant.userProfile?.user;
    const clientUser = client.userProfile?.user;
    // Prepare session details
    const clientEmail = client.userProfile?.user?.email;
    const clientFirstName = client.userProfile?.user?.firstName || 'Customer';
    const clientLastName = client.userProfile?.user?.lastName || '';

    const consultantEmail = consultant.userProfile?.user?.email;
    const consultantFirstName =
      consultant.userProfile?.user?.firstName || 'Consultant';
    const consultantLastName = consultant.userProfile?.user?.lastName || '';

    // Helper function to create calendar event for a user
    const createCalendarEventForUser = async (
      user: { id: string; email: string },
      userType: 'consultant' | 'client',
      session: any,
    ): Promise<string | null> => {
      try {
        const calendarIntegrations =
          await this.calendarIntegrationService.getIntegration(
            user.id,
            'google',
          );

        const calendarIntegration = Array.isArray(calendarIntegrations)
          ? calendarIntegrations.find(
              (ci) => ci.isConnected && ci.provider === 'google',
            )
          : calendarIntegrations;

        if (!calendarIntegration) {
          return null;
        }

        const calendarCredentials =
          await this.calendarIntegrationService.getCredentials(
            user.id,
            'google',
          );

        if (!calendarCredentials) {
          return null;
        }

        const sessionDate = new Date(session.scheduledDate);
        const sessionEndDate = addMinutes(sessionDate, 60); // 1 hour session

        const eventSummary = `Therapy Session - ${dto.sessionType}`;
        const eventDescription =
          userType === 'consultant'
            ? `Session with ${clientFirstName} ${clientLastName}\n\nSession Type: ${dto.sessionType}\nMeeting Link: ${session.meetingUrl || 'TBD'}`
            : `Session with ${consultantFirstName} ${consultantLastName}\n\nSession Type: ${dto.sessionType}\nMeeting Link: ${session.meetingUrl || 'TBD'}`;

        // Build attendees list
        const attendees: Array<{
          email: string;
          displayName?: string;
          responseStatus?:
            | 'accepted'
            | 'needsAction'
            | 'declined'
            | 'tentative';
        }> = [
          {
            email: clientEmail || '',
            displayName: `${clientFirstName} ${clientLastName}`,
            responseStatus: userType === 'client' ? 'accepted' : 'needsAction',
          },
          {
            email: consultantEmail || '',
            displayName: `${consultantFirstName} ${consultantLastName}`,
            responseStatus:
              userType === 'consultant' ? 'accepted' : 'needsAction',
          },
        ];

        // Add participants for couple sessions
        if (
          dto.sessionType === 'COUPLE' &&
          sessions[0].participants &&
          sessions[0].participants.length > 0
        ) {
          for (const participant of sessions[0].participants) {
            attendees.push({
              email: participant.email,
              displayName: participant.name,
              responseStatus: 'needsAction',
            });
          }
        }

        const calendarEventId = await this.calendarService.createEvent(
          calendarCredentials,
          {
            summary: eventSummary,
            description: eventDescription,
            start: {
              dateTime: sessionDate.toISOString(),
              timeZone: session.clientTimezone || 'Africa/Lagos',
            },
            end: {
              dateTime: sessionEndDate.toISOString(),
              timeZone: session.clientTimezone || 'Africa/Lagos',
            },
            attendees,
            location: session.meetingUrl || 'Video Conference',
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 1440 }, // 24 hours
                { method: 'popup', minutes: 60 }, // 1 hour
              ],
            },
          },
          'google',
        );

        if (calendarEventId) {
          this.logger.log(
            `Calendar event created for ${userType} ${user.email} on session ${session.id}: ${calendarEventId}`,
          );
        }

        return calendarEventId;
      } catch (error) {
        this.logger.error(
          `Failed to create calendar event for ${userType} ${user.email}: ${error.message}`,
        );
        return null;
      }
    };

    // Create calendar events for each session
    for (const session of sessions) {
      let consultantEventId: string | null = null;
      let clientEventId: string | null = null;

      // Create event on consultant's calendar
      if (consultantUser) {
        consultantEventId = await createCalendarEventForUser(
          consultantUser,
          'consultant',
          session,
        );
      }

      // Create event on client's calendar
      if (clientUser) {
        clientEventId = await createCalendarEventForUser(
          clientUser,
          'client',
          session,
        );
      }

      // Store calendar event IDs on session
      // Use consultant's event ID as primary (for backward compatibility)
      // Store client's event ID in metadata
      const currentMetadata = (session.metadata || {}) as Record<string, any>;

      const updateData: any = {
        metadata: {
          ...currentMetadata,
          clientCalendarEventId: clientEventId, // Store client's event ID in metadata
        },
      };

      if (consultantEventId) {
        // Get consultant's calendar integration to store the ID
        const consultantCalendarIntegrations =
          await this.calendarIntegrationService.getIntegration(
            consultantUser.id,
            'google',
          );

        const consultantCalendarIntegration = Array.isArray(
          consultantCalendarIntegrations,
        )
          ? consultantCalendarIntegrations.find(
              (ci) => ci.isConnected && ci.provider === 'google',
            )
          : consultantCalendarIntegrations;

        if (consultantCalendarIntegration) {
          updateData.calendarEventId = consultantEventId; // Store consultant's event ID as primary
          updateData.calendarIntegrationId = consultantCalendarIntegration.id;
          updateData.metadata.calendarEventId = consultantEventId; // Also keep in metadata for backward compatibility
        }
      }

      await this.prismaService.tenancy.session.update({
        where: { id: session.id },
        data: updateData,
      });

      this.logger.log(
        `Session ${session.id} calendar events - Consultant: ${consultantEventId || 'N/A'}, Client: ${clientEventId || 'N/A'}`,
      );
    }
  }
}
