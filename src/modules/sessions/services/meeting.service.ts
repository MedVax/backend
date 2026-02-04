import { Injectable, Logger } from '@nestjs/common';
import { CloudflareRealtimeKitService } from 'src/services/cloudflare-realtime-kit.service';

export interface MeetingResponse {
  id: string;
  roomName: string;
  meetingUrl: string;
  participantTokens?: Map<string, string>; // Map of userId/email to auth token
}

export interface ParticipantInfo {
  userId: string;
  userName: string;
  userEmail: string;
  picture?: string;
  presetName?: string;
}

@Injectable()
export class MeetingService {
  private logger = new Logger(MeetingService.name);

  constructor(
    private readonly cloudflareRealtimeKitService: CloudflareRealtimeKitService,
  ) {}

  /**
   * Create a Cloudflare Realtime Kit meeting for a session
   */
  async createMeeting(
    title: string,
    participants?: ParticipantInfo[],
  ): Promise<MeetingResponse | null> {
    try {
      const meeting = await this.cloudflareRealtimeKitService.createMeeting({
        title,
        recordingEnabled: false,
        livestreamEnabled: false,
      });

      if (!meeting) {
        this.logger.error('Failed to create Cloudflare Realtime Kit meeting');
        return null;
      }

      // Generate meeting URL
      const meetingUrl = this.cloudflareRealtimeKitService.generateMeetingUrl(
        meeting.id,
      );

      // Add participants if provided and collect their tokens
      const participantTokens: Map<string, string> = new Map();
      if (participants && participants.length > 0) {
        const participantResults =
          await this.cloudflareRealtimeKitService.addParticipants(
            meeting.id,
            participants.map((p) => ({
              name: p.userName,
              presetId: p.presetName || undefined,
              customParticipantId: p.userId,
              picture: p.picture || undefined,
            })),
          );

        // Map participant tokens by userId or email
        participantResults.forEach((result) => {
          if (result.token) {
            const key = result.custom_participant_id || result.id;
            if (key) {
              participantTokens.set(key, result.token);
            }
          }
        });
      }

      return {
        id: meeting.id,
        roomName: meeting.title || meeting.id,
        meetingUrl,
        participantTokens, // Include tokens in response
      };
    } catch (error) {
      this.logger.error(`Failed to create meeting: ${error.message}`);
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
    presetName: string = 'default',
  ): Promise<string | null> {
    try {
      const authToken =
        await this.cloudflareRealtimeKitService.getParticipantAuthToken(
          meetingId,
          {
            name: userName,
            presetId: presetName,
            customParticipantId: userId,
          },
        );

      if (authToken) {
        this.logger.log(
          `Auth token generated for participant ${userId} in meeting ${meetingId}`,
        );
      }

      return authToken;
    } catch (error) {
      this.logger.error(
        `Failed to get participant auth token: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Add a participant to an existing meeting
   */
  async addParticipant(
    meetingId: string,
    participant: ParticipantInfo,
  ): Promise<string | null> {
    try {
      const participantResponse =
        await this.cloudflareRealtimeKitService.addParticipant(meetingId, {
          name: participant.userName,
          presetId: participant.presetName || undefined,
          customParticipantId: participant.userId,
        });

      return participantResponse?.token || null;
    } catch (error) {
      this.logger.error(`Failed to add participant: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate meeting URL from meeting ID
   */
  generateMeetingUrl(meetingId: string): string {
    return this.cloudflareRealtimeKitService.generateMeetingUrl(meetingId);
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<any | null> {
    return this.cloudflareRealtimeKitService.getMeeting(meetingId);
  }

  /**
   * Get all participants in a meeting
   */
  async getMeetingParticipants(meetingId: string): Promise<any[] | null> {
    return this.cloudflareRealtimeKitService.getMeetingParticipants(meetingId);
  }

  /**
   * Start recording a meeting
   */
  async startRecording(meetingId: string): Promise<any | null> {
    return this.cloudflareRealtimeKitService.startRecording(meetingId);
  }
}
