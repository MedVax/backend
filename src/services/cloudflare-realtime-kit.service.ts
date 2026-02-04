import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import {
  CLOUDFLARE_REALTIME_KIT_API_TOKEN,
  CLOUDFLARE_REALTIME_KIT_ACCOUNT_ID,
  CLOUDFLARE_REALTIME_KIT_APP_ID,
  CLOUDFLARE_REALTIME_KIT_BASE_URL,
  FRONTEND_URL,
} from 'constants/env.constant';

export interface RealtimeKitMeeting {
  id: string;
  title?: string;
  createdAt?: string;
  status?: string;
}

export interface RealtimeKitParticipant {
  id: string;
  name: string;
  picture?: string;
  customParticipantId?: string;
  presetId?: string;
}

export interface RealtimeKitParticipantResponse {
  id: string;
  token: string;
  created_at: string;
  custom_participant_id: string;
  preset_name: string;
  updated_at: string;
  name: string;
  picture: string;
}

export interface CreateMeetingOptions {
  title: string;
  presetId?: string;
  recordingEnabled?: boolean;
  livestreamEnabled?: boolean;
}

export interface AddParticipantOptions {
  name: string;
  picture?: string;
  presetId?: string;
  customParticipantId?: string;
}

@Injectable()
export class CloudflareRealtimeKitService {
  private readonly logger = new Logger(CloudflareRealtimeKitService.name);
  private readonly apiToken: string;
  private readonly accountId: string;
  private readonly appId: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiToken = CLOUDFLARE_REALTIME_KIT_API_TOKEN || '';
    this.accountId = CLOUDFLARE_REALTIME_KIT_ACCOUNT_ID || '';
    this.appId = CLOUDFLARE_REALTIME_KIT_APP_ID || '';
    this.baseUrl =
      CLOUDFLARE_REALTIME_KIT_BASE_URL ||
      'https://api.cloudflare.com/client/v4/accounts';

    if (!this.apiToken || !this.accountId || !this.appId) {
      this.logger.warn(
        'Cloudflare Realtime Kit API token, Account ID, or App ID not configured. Realtime Kit operations will fail.',
      );
    }
  }

  /**
   * Check if Cloudflare Realtime Kit is properly configured
   */
  private isConfigured(): boolean {
    return !!this.apiToken && !!this.accountId && !!this.appId;
  }

  /**
   * Get authorization header for Cloudflare Realtime Kit API requests
   */
  private getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new meeting
   * Reference: https://developers.cloudflare.com/api/resources/realtime_kit/#meetings
   */
  async createMeeting(
    options: CreateMeetingOptions,
  ): Promise<RealtimeKitMeeting | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot create meeting: Cloudflare Realtime Kit not configured',
      );
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.accountId}/realtime/kit/${this.appId}/meetings`,
        {
          title: options.title,
          presetId: options.presetId || '8dad1a21-91d5-469e-a7f5-97efd8063465',
          recordingEnabled: options.recordingEnabled || false,
          livestreamEnabled: options.livestreamEnabled || false,
        },
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        this.logger.log(
          `Cloudflare Realtime Kit meeting created: ${response.data.data.id}`,
        );
        return response.data.data as RealtimeKitMeeting;
      }

      throw new Error('Failed to create meeting: Invalid response');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to create meeting: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to create meeting: ${error.message}`);
      }

      return null;
    }
  }

  /**
   * Add a participant to a meeting
   * Reference: https://developers.cloudflare.com/api/resources/realtime_kit/#meetings
   */
  async addParticipant(
    meetingId: string,
    options: AddParticipantOptions,
  ): Promise<RealtimeKitParticipantResponse | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot add participant: Cloudflare Realtime Kit not configured',
      );
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.accountId}/realtime/kit/${this.appId}/meetings/${meetingId}/participants`,
        {
          name: options.name,
          picture: options.picture || '',
          preset_name: options.presetId || 'default',
          custom_participant_id: options.customParticipantId,
        },
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        this.logger.log(
          `Participant ${options.name} added to meeting ${meetingId}`,
        );
        return response.data.data as RealtimeKitParticipantResponse;
      }

      throw new Error('Failed to add participant: Invalid response');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to add participant: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to add participant: ${error.message}`);
      }

      return null;
    }
  }

  /**
   * Add multiple participants to a meeting
   */
  async addParticipants(
    meetingId: string,
    participants: AddParticipantOptions[],
  ): Promise<RealtimeKitParticipantResponse[]> {
    const results: RealtimeKitParticipantResponse[] = [];

    for (const participant of participants) {
      const result = await this.addParticipant(meetingId, participant);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get meeting details
   * Reference: https://developers.cloudflare.com/api/resources/realtime_kit/#meetings
   */
  async getMeeting(meetingId: string): Promise<RealtimeKitMeeting | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot get meeting: Cloudflare Realtime Kit not configured',
      );
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.accountId}/realtime/kit/${this.appId}/meetings/${meetingId}`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data as RealtimeKitMeeting;
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to get meeting: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to get meeting: ${error.message}`);
      }

      return null;
    }
  }

  /**
   * Update a meeting
   * Reference: https://developers.cloudflare.com/api/resources/realtime_kit/#meetings
   */
  async updateMeeting(
    meetingId: string,
    updates: Partial<CreateMeetingOptions>,
  ): Promise<RealtimeKitMeeting | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot update meeting: Cloudflare Realtime Kit not configured',
      );
      return null;
    }

    try {
      const response = await axios.patch(
        `${this.baseUrl}/${this.accountId}/realtime/kit/${this.appId}/meetings/${meetingId}`,
        updates,
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data as RealtimeKitMeeting;
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to update meeting: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to update meeting: ${error.message}`);
      }

      return null;
    }
  }

  /**
   * Get all participants in a meeting
   * Reference: https://developers.cloudflare.com/api/resources/realtime_kit/#meetings
   */
  async getMeetingParticipants(
    meetingId: string,
  ): Promise<RealtimeKitParticipant[] | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot get participants: Cloudflare Realtime Kit not configured',
      );
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.accountId}/realtime/kit/${this.appId}/meetings/${meetingId}/participants`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data as RealtimeKitParticipant[];
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to get participants: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to get participants: ${error.message}`);
      }

      return null;
    }
  }

  /**
   * Get participant details
   * Reference: https://developers.cloudflare.com/api/resources/realtime_kit/#meetings
   */
  async getParticipant(
    meetingId: string,
    participantId: string,
  ): Promise<RealtimeKitParticipantResponse | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot get participant: Cloudflare Realtime Kit not configured',
      );
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.accountId}/realtime/kit/${this.appId}/meetings/${meetingId}/participants/${participantId}`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data as RealtimeKitParticipantResponse;
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to get participant: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to get participant: ${error.message}`);
      }

      return null;
    }
  }

  /**
   * Refresh participant authentication token
   * Reference: https://developers.cloudflare.com/api/resources/realtime_kit/#meetings
   */
  async refreshParticipantToken(
    meetingId: string,
    participantId: string,
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot refresh token: Cloudflare Realtime Kit not configured',
      );
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.accountId}/realtime/kit/${this.appId}/meetings/${meetingId}/participants/${participantId}/token`,
        {},
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data?.tokens?.authToken) {
        return response.data.data.tokens.authToken;
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to refresh token: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to refresh token: ${error.message}`);
      }

      return null;
    }
  }

  /**
   * Get participant auth token for a meeting
   * This is a convenience method that adds a participant and returns the auth token
   */
  async getParticipantAuthToken(
    meetingId: string,
    options: AddParticipantOptions,
  ): Promise<string | null> {
    const participant = await this.addParticipant(meetingId, options);
    return participant?.token || null;
  }

  /**
   * Generate meeting URL from meeting ID
   * Note: Cloudflare Realtime Kit doesn't have a standard app URL format
   * You'll need to use your own frontend URL with the meeting ID
   */
  generateMeetingUrl(meetingId: string): string {
    return `${FRONTEND_URL}/meeting/${meetingId}`;
  }

  /**
   * Start recording a meeting
   * Reference: https://developers.cloudflare.com/api/resources/realtime_kit/#recordings
   */
  async startRecording(meetingId: string): Promise<any | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot start recording: Cloudflare Realtime Kit not configured',
      );
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.accountId}/realtime/kit/${this.appId}/recordings`,
        {
          meetingId,
        },
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to start recording: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to start recording: ${error.message}`);
      }

      return null;
    }
  }
}
