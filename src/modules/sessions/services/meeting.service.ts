import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

export interface MeetingResponse {
  id: string;
  roomName: string;
  authToken: string;
  authResponse: {
    authToken: string;
    userAdded: boolean;
  };
}

@Injectable()
export class MeetingService {
  private logger = new Logger(MeetingService.name);
  private readonly dyteApiKey: string;
  private readonly dyteOrgId: string;
  private readonly dyteBaseUrl: string;

  constructor() {
    this.dyteApiKey = process.env.DYTE_API_KEY || '';
    this.dyteOrgId = process.env.DYTE_ORG_ID || '';
    this.dyteBaseUrl = process.env.DYTE_BASE_URL || 'https://api.dyte.io/v2';

    if (!this.dyteApiKey || !this.dyteOrgId) {
      this.logger.warn(
        'Dyte API key or Org ID not configured. Meeting creation will fail.',
      );
    }
  }

  /**
   * Create a Dyte meeting for a session
   */
  async createMeeting(
    title: string,
    // participantIds?: string[],
  ): Promise<MeetingResponse | null> {
    if (!this.dyteApiKey || !this.dyteOrgId) {
      this.logger.error(
        'Cannot create meeting: Dyte API key or Org ID not configured',
      );
      return null;
    }

    try {
      const response = await axios.post(
        `${this.dyteBaseUrl}/organizations/${this.dyteOrgId}/meeting`,
        {
          title,
          preferredRegion: 'US', // Can be configured
          recordOnStart: false,
          liveStreamOnStart: false,
          recordingConfig: {
            maxSeconds: 3600, // 1 hour max recording
            fileNamePrefix: 'session',
            videoConfig: {
              codec: 'VP8',
              width: 1280,
              height: 720,
            },
            audioConfig: {
              codec: 'OPUS',
              channel: 'stereo',
              sampleRate: 48000,
            },
            storageConfig: {
              type: 'aws-s3',
              accessKey: process.env.DYTE_S3_ACCESS_KEY,
              secret: process.env.DYTE_S3_SECRET_KEY,
              bucket: process.env.DYTE_S3_BUCKET,
              region: process.env.DYTE_S3_REGION || 'us-east-1',
              path: 'recordings/',
            },
          },
        },
        {
          headers: {
            Authorization: `API_KEY ${this.dyteApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data?.success && response.data?.data) {
        this.logger.log(`Dyte meeting created: ${response.data.data.id}`);
        return response.data.data as MeetingResponse;
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

      // Return null instead of throwing - sessions can exist without meetings
      return null;
    }
  }

  /**
   * Get meeting auth token for a participant
   */
  async getParticipantAuthToken(
    meetingId: string,
    userId: string,
    userName: string,
    userEmail: string,
    presetName: string = 'group_call_participant',
  ): Promise<string | null> {
    if (!this.dyteApiKey || !this.dyteOrgId) {
      this.logger.error(
        'Cannot get auth token: Dyte API key or Org ID not configured',
      );
      return null;
    }

    try {
      const response = await axios.post(
        `${this.dyteBaseUrl}/organizations/${this.dyteOrgId}/meetings/${meetingId}/participants`,
        {
          name: userName,
          picture: '', // Optional: user avatar URL
          presetName,
          customParticipantId: userId,
        },
        {
          headers: {
            Authorization: `API_KEY ${this.dyteApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data?.success && response.data?.data?.tokens?.authToken) {
        this.logger.log(
          `Auth token generated for participant ${userId} in meeting ${meetingId}`,
        );
        return response.data.data.tokens.authToken;
      }

      throw new Error('Failed to get participant auth token: Invalid response');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to get participant auth token: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(
          `Failed to get participant auth token: ${error.message}`,
        );
      }

      return null;
    }
  }

  /**
   * End a meeting
   */
  async endMeeting(meetingId: string): Promise<boolean> {
    if (!this.dyteApiKey || !this.dyteOrgId) {
      this.logger.error(
        'Cannot end meeting: Dyte API key or Org ID not configured',
      );
      return false;
    }

    try {
      await axios.post(
        `${this.dyteBaseUrl}/organizations/${this.dyteOrgId}/meetings/${meetingId}/end`,
        {},
        {
          headers: {
            Authorization: `API_KEY ${this.dyteApiKey}`,
            'Content-Type': 'application/json',
          },
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
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<any | null> {
    if (!this.dyteApiKey || !this.dyteOrgId) {
      this.logger.error(
        'Cannot get meeting: Dyte API key or Org ID not configured',
      );
      return null;
    }

    try {
      const response = await axios.get(
        `${this.dyteBaseUrl}/organizations/${this.dyteOrgId}/meetings/${meetingId}`,
        {
          headers: {
            Authorization: `API_KEY ${this.dyteApiKey}`,
            'Content-Type': 'application/json',
          },
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
          `Failed to get meeting: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      } else {
        this.logger.error(`Failed to get meeting: ${error.message}`);
      }

      return null;
    }
  }
}
