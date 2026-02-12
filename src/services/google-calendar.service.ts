import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Global } from '@nestjs/common';
import { GOOGLE_CLIENT_ID } from 'constants/env.constant';
import { GOOGLE_CLIENT_SECRET } from 'constants/env.constant';
import { GOOGLE_REDIRECT_URI } from 'constants/env.constant';
import { google } from 'googleapis';
import {
  CalendarCredentials,
  CalendarEvent,
} from 'modules/sessions/services/calendar.service';

@Injectable()
@Global()
export class GoogleCalendarService {
  constructor() {
    const clientId = GOOGLE_CLIENT_ID || '';
    const clientSecret = GOOGLE_CLIENT_SECRET || '';
    const redirectUri = GOOGLE_REDIRECT_URI || '';

    if (clientId && clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri,
      );
    } else {
      this.logger.warn(
        'Google Calendar credentials not configured. Calendar integration will be disabled.',
      );
    }
  }

  private readonly oauth2Client: any;

  private readonly logger = new Logger(GoogleCalendarService.name);

  private readonly scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ];

  getAuthUrl(redirectUri?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      prompt: 'consent',
      ...(redirectUri && { redirect_uri: redirectUri }),
    });
  }

  async getTokens(code: string): Promise<any> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      };
    } catch (error) {
      this.logger.error(error, `Failed to get tokens: ${error}`);
      throw new BadRequestException(
        'Failed to get tokens from Google Calendar',
      );
    }
  }

  /**
   * Create Google Calendar event
   */
  async createEvent(
    credentials: CalendarCredentials,
    event: CalendarEvent,
  ): Promise<string | null> {
    if (!this.oauth2Client) {
      this.logger.error(
        'Cannot create Google Calendar event: OAuth2 client not initialized',
      );
      return null;
    }

    try {
      // Set credentials
      this.oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
        expiry_date: credentials.expiryDate,
      });

      const calendar = google.calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });

      const calendarEvent: any = {
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        location: event.location,
        reminders: event.reminders || {
          useDefault: true,
        },
      };

      // Add conference data if meeting URL is provided
      if (
        event.conferenceData?.entryPoints &&
        event.conferenceData.entryPoints.length > 0
      ) {
        calendarEvent.conferenceData = {
          entryPoints: event.conferenceData.entryPoints,
        };
      }

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: calendarEvent,
        sendUpdates: 'all', // Send email notifications to attendees
      });

      if (response.data?.id) {
        this.logger.log(`Google Calendar event created: ${response.data.id}`);
        return response.data.id;
      }

      return null;
    } catch (error: any) {
      this.logger.error(
        `Failed to create Google Calendar event: ${error.message}`,
      );

      // Try to refresh token if expired
      if (error.code === 401 && credentials.refreshToken) {
        try {
          const { credentials: newCredentials } =
            await this.oauth2Client.refreshAccessToken();
          this.oauth2Client.setCredentials(newCredentials);

          // Retry with new token
          return this.createEvent(
            {
              accessToken: newCredentials.access_token,
              refreshToken: credentials.refreshToken,
              expiryDate: newCredentials.expiry_date,
            },
            event,
          );
        } catch (refreshError) {
          this.logger.error(
            `Failed to refresh Google Calendar token: ${refreshError.message}`,
          );
        }
      }

      return null;
    }
  }

  /**
   * Update Google Calendar event
   */
  async updateEvent(
    credentials: CalendarCredentials,
    eventId: string,
    event: Partial<CalendarEvent>,
  ): Promise<boolean> {
    if (!this.oauth2Client) {
      this.logger.error(
        'Cannot update Google Calendar event: OAuth2 client not initialized',
      );
      return false;
    }

    try {
      this.oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
        expiry_date: credentials.expiryDate,
      });

      const calendar = google.calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });

      const updateData: any = {};
      if (event.summary) updateData.summary = event.summary;
      if (event.description) updateData.description = event.description;
      if (event.start) updateData.start = event.start;
      if (event.end) updateData.end = event.end;
      if (event.attendees) updateData.attendees = event.attendees;
      if (event.location) updateData.location = event.location;
      if (
        event.conferenceData?.entryPoints &&
        event.conferenceData.entryPoints.length > 0
      ) {
        updateData.conferenceData = {
          entryPoints: event.conferenceData.entryPoints,
        };
      }

      await calendar.events.update({
        calendarId: 'primary',
        eventId,
        requestBody: updateData,
        sendUpdates: 'all',
      });

      this.logger.log(`Google Calendar event updated: ${eventId}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to update Google Calendar event: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Delete Google Calendar event
   */
  async deleteEvent(
    credentials: CalendarCredentials,
    eventId: string,
  ): Promise<boolean> {
    if (!this.oauth2Client) {
      this.logger.error(
        'Cannot delete Google Calendar event: OAuth2 client not initialized',
      );
      return false;
    }

    try {
      this.oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
        expiry_date: credentials.expiryDate,
      });

      const calendar = google.calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'all',
      });

      this.logger.log(`Google Calendar event deleted: ${eventId}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to delete Google Calendar event: ${error.message}`,
      );
      return false;
    }
  }
}
