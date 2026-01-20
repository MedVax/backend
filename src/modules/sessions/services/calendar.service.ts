import { Injectable, Logger } from '@nestjs/common';
import { GoogleCalendarService } from 'src/services/google-calendar.service';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string; // ISO 8601
    timeZone: string;
  };
  end: {
    dateTime: string; // ISO 8601
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'accepted' | 'declined' | 'tentative';
  }>;
  location?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export interface CalendarCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

@Injectable()
export class CalendarService {
  private logger = new Logger(CalendarService.name);
  private readonly oauth2Client: any;

  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  /**
   * Create a calendar event (Google Calendar, Outlook, etc.)
   */
  createEvent(
    credentials: CalendarCredentials,
    event: CalendarEvent,
    calendarProvider: 'google' | 'outlook' | 'ical' = 'google',
  ): Promise<string | null> {
    if (calendarProvider === 'google') {
      return this.googleCalendarService.createEvent(credentials, event);
    }

    // TODO: Implement Outlook and iCal support
    this.logger.warn(
      `Calendar provider ${calendarProvider} not yet implemented`,
    );
    return null;
  }

  /**
   * Update a calendar event
   */
  async updateEvent(
    credentials: CalendarCredentials,
    eventId: string,
    event: Partial<CalendarEvent>,
    calendarProvider: 'google' | 'outlook' | 'ical' = 'google',
  ): Promise<boolean> {
    if (calendarProvider === 'google') {
      return await this.googleCalendarService.updateEvent(
        credentials,
        eventId,
        event,
      );
    }

    this.logger.warn(
      `Calendar provider ${calendarProvider} not yet implemented`,
    );
    return false;
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    credentials: CalendarCredentials,
    eventId: string,
    calendarProvider: 'google' | 'outlook' | 'ical' = 'google',
  ): Promise<boolean> {
    if (calendarProvider === 'google') {
      return await this.googleCalendarService.deleteEvent(credentials, eventId);
    }

    this.logger.warn(
      `Calendar provider ${calendarProvider} not yet implemented`,
    );
    return false;
  }

  /**
   * Generate iCal file content for calendar integration
   */
  generateICalFile(event: CalendarEvent): string {
    const formatDate = (dateTime: string) => {
      return dateTime.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const startDate = formatDate(event.start.dateTime);
    const endDate = formatDate(event.end.dateTime);
    const uid = `session-${Date.now()}@medvax.com`;

    let ical = `BEGIN:VCALENDAR\r\n`;
    ical += `VERSION:2.0\r\n`;
    ical += `PRODID:-//Medvax//Session Booking//EN\r\n`;
    ical += `CALSCALE:GREGORIAN\r\n`;
    ical += `METHOD:REQUEST\r\n`;
    ical += `BEGIN:VEVENT\r\n`;
    ical += `UID:${uid}\r\n`;
    ical += `DTSTAMP:${formatDate(new Date().toISOString())}Z\r\n`;
    ical += `DTSTART:${startDate}Z\r\n`;
    ical += `DTEND:${endDate}Z\r\n`;
    ical += `SUMMARY:${event.summary}\r\n`;
    if (event.description) {
      ical += `DESCRIPTION:${event.description.replace(/\r?\n/g, '\\n')}\r\n`;
    }
    if (event.location) {
      ical += `LOCATION:${event.location}\r\n`;
    }

    if (event.attendees) {
      for (const attendee of event.attendees) {
        ical += `ATTENDEE;CN=${attendee.displayName || attendee.email};RSVP=TRUE:mailto:${attendee.email}\r\n`;
      }
    }

    if (event.reminders) {
      if (event.reminders.useDefault) {
        ical += `BEGIN:VALARM\r\n`;
        ical += `TRIGGER:-PT15M\r\n`;
        ical += `ACTION:DISPLAY\r\n`;
        ical += `DESCRIPTION:Reminder\r\n`;
        ical += `END:VALARM\r\n`;
      } else if (event.reminders.overrides) {
        for (const reminder of event.reminders.overrides) {
          ical += `BEGIN:VALARM\r\n`;
          ical += `TRIGGER:-PT${reminder.minutes}M\r\n`;
          ical += `ACTION:${reminder.method.toUpperCase()}\r\n`;
          ical += `DESCRIPTION:Reminder\r\n`;
          ical += `END:VALARM\r\n`;
        }
      }
    }

    ical += `END:VEVENT\r\n`;
    ical += `END:VCALENDAR\r\n`;

    return ical;
  }
}
