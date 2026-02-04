import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import {
  DYTE_API_KEY,
  DYTE_ORG_ID,
  DYTE_BASE_URL,
  DYTE_APP_URL,
} from 'constants/env.constant';

export interface DyteMeeting {
  id: string;
  roomName: string;
  createdAt: string;
  status: string;
}

export interface DyteParticipant {
  id: string;
  name: string;
  picture?: string;
  customParticipantId?: string;
  presetName?: string;
}

export interface DyteParticipantResponse {
  id: string;
  name: string;
  picture?: string;
  customParticipantId?: string;
  tokens: {
    authToken: string;
  };
  userAdded: boolean;
}

export interface CreateMeetingOptions {
  title: string;
  preferredRegion?: string;
  recordOnStart?: boolean;
  liveStreamOnStart?: boolean;
  recordingConfig?: {
    maxSeconds?: number;
    fileNamePrefix?: string;
    videoConfig?: {
      codec: string;
      width: number;
      height: number;
    };
    audioConfig?: {
      codec: string;
      channel: string;
      sampleRate: number;
    };
    storageConfig?: {
      type: string;
      accessKey?: string;
      secret?: string;
      bucket?: string;
      region?: string;
      path?: string;
    };
  };
}

export interface AddParticipantOptions {
  name: string;
  picture?: string;
  presetName?: string;
  customParticipantId?: string;
}

@Injectable()
export class DyteService {
  private readonly logger = new Logger(DyteService.name);
  private readonly apiKey: string;
  private readonly orgId: string;
  private readonly baseUrl: string;
  private readonly appUrl: string;

  constructor() {
    this.apiKey = DYTE_API_KEY || '';
    this.orgId = DYTE_ORG_ID || '';
    this.baseUrl = DYTE_BASE_URL || 'https://api.dyte.io/v2';
    this.appUrl = DYTE_APP_URL || 'https://app.dyte.io';

    if (!this.apiKey || !this.orgId) {
      this.logger.warn(
        'Dyte API key or Org ID not configured. Dyte operations will fail.',
      );
    }
  }

  /**
   * Check if Dyte is properly configured
   */
  private isConfigured(): boolean {
    return !!this.apiKey && !!this.orgId;
  }

  /**
   * Get authorization header for Dyte API requests
   */
  private getAuthHeaders() {
    return {
      Authorization: `API_KEY ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new Dyte meeting
   */
  async createMeeting(
    options: CreateMeetingOptions,
  ): Promise<DyteMeeting | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot create meeting: Dyte API key or Org ID not configured',
      );
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/organizations/${this.orgId}/meeting`,
        {
          title: options.title,
          preferredRegion: options.preferredRegion || 'US',
          recordOnStart: options.recordOnStart || false,
          liveStreamOnStart: options.liveStreamOnStart || false,
          recordingConfig: options.recordingConfig,
        },
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        this.logger.log(`Dyte meeting created: ${response.data.data.id}`);
        return response.data.data as DyteMeeting;
      }

      throw new Error('Failed to create Dyte meeting: Invalid response');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to create Dyte meeting: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to create Dyte meeting: ${error.message}`);
      }

      return null;
    }
  }

  /**
   * Add a participant to a meeting
   */
  async addParticipant(
    meetingId: string,
    options: AddParticipantOptions,
  ): Promise<DyteParticipantResponse | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot add participant: Dyte API key or Org ID not configured',
      );
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/organizations/${this.orgId}/meetings/${meetingId}/participants`,
        {
          name: options.name,
          picture: options.picture || '',
          presetName: options.presetName || 'default',
          customParticipantId: options.customParticipantId,
        },
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        this.logger.log(
          `Participant ${options.name} added to meeting ${meetingId}`,
        );
        return response.data.data as DyteParticipantResponse;
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
  ): Promise<DyteParticipantResponse[]> {
    const results: DyteParticipantResponse[] = [];

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
   */
  async getMeeting(meetingId: string): Promise<DyteMeeting | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot get meeting: Dyte API key or Org ID not configured',
      );
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/organizations/${this.orgId}/meetings/${meetingId}`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data as DyteMeeting;
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
   * End a meeting
   */
  async endMeeting(meetingId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot end meeting: Dyte API key or Org ID not configured',
      );
      return false;
    }

    try {
      await axios.post(
        `${this.baseUrl}/organizations/${this.orgId}/meetings/${meetingId}/end`,
        {},
        {
          headers: this.getAuthHeaders(),
        },
      );

      this.logger.log(`Meeting ${meetingId} ended successfully`);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to end meeting: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to end meeting: ${error.message}`);
      }

      return false;
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
    return participant?.tokens?.authToken || null;
  }

  /**
   * Generate meeting URL from meeting ID
   */
  generateMeetingUrl(meetingId: string): string {
    return `${this.appUrl}/${meetingId}`;
  }

  /**
   * Get all participants in a meeting
   */
  async getMeetingParticipants(
    meetingId: string,
  ): Promise<DyteParticipant[] | null> {
    if (!this.isConfigured()) {
      this.logger.error(
        'Cannot get participants: Dyte API key or Org ID not configured',
      );
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/organizations/${this.orgId}/meetings/${meetingId}/participants`,
        {
          headers: this.getAuthHeaders(),
        },
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data as DyteParticipant[];
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
}
