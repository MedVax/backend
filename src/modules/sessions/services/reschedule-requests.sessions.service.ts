import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { ProviderAvailabilityService } from './provider-availability.service';
import { SessionStatus } from 'generated/prisma/enums';
import { isBefore } from 'date-fns';
import {
  SESSION_BUFFER_HOURS,
  SESSION_EVENTS,
} from '../constants/sessions.constant';
import { SessionRescheduleEvent } from '../events/sessions.event';

export interface CreateRescheduleRequestDto {
  sessionId: string;
  requestedBy: string; // userId
  requestedDate: Date;
  requestedDateString: string;
  reason?: string;
}

export interface RespondToRescheduleRequestDto {
  requestId: string;
  respondedBy: string; // userId
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
}

@Injectable()
export class RescheduleRequestsSessionsService {
  private logger = new Logger(RescheduleRequestsSessionsService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private providerAvailabilityService: ProviderAvailabilityService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a reschedule request
   */
  async createRescheduleRequest(dto: CreateRescheduleRequestDto) {
    // Get session
    const session = await this.prismaService.tenancy.session.findUnique({
      where: { id: dto.sessionId },
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
      throw new NotFoundException(`Session with ID ${dto.sessionId} not found`);
    }

    // Verify user has permission (must be client)
    if (session.clientId !== dto.requestedBy) {
      throw new BadRequestException(
        'Only the client can request to reschedule a session',
      );
    }

    // Verify session is in valid status
    if (
      session.status !== SessionStatus.PENDING &&
      session.status !== SessionStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException(
        `Cannot reschedule session with status: ${session.status}`,
      );
    }

    // Verify new date is not in the past
    const requestedDate = dto.requestedDateString;
    const now = new Date().toISOString();
    if (isBefore(requestedDate, now)) {
      throw new BadRequestException('Cannot reschedule to a past date');
    }

    // Verify new slot is available
    const isAvailable = await this.providerAvailabilityService.isSlotAvailable(
      session.consultantId,
      dto.requestedDateString,
      SESSION_BUFFER_HOURS,
    );

    if (!isAvailable) {
      throw new BadRequestException('Requested time slot is not available');
    }

    // Check if there's already a pending reschedule request
    const existingRequest =
      await this.prismaService.tenancy.sessionRescheduleRequest.findFirst({
        where: {
          sessionId: dto.sessionId,
          status: 'PENDING',
        },
      });

    if (existingRequest) {
      throw new BadRequestException(
        'There is already a pending reschedule request for this session',
      );
    }

    // Create reschedule request
    const request =
      await this.prismaService.tenancy.sessionRescheduleRequest.create({
        data: {
          id: `reschedule-${Date.now()}-${dto.sessionId}`,
          sessionId: dto.sessionId,
          requestedBy: dto.requestedBy,
          requestedDate: dto.requestedDate,
          requestedDateString: dto.requestedDateString,
          reason: dto.reason,
          status: 'PENDING',
        },
        include: {
          session: {
            include: {
              client: true,
              consultant: true,
            },
          },
        },
      });

    this.logger.log(
      `Reschedule request created: ${request.id} for session ${dto.sessionId}`,
    );

    // TODO: Send notification to consultant
    // await this.mailService.sendRescheduleRequestNotification({...});

    return request;
  }

  /**
   * Respond to a reschedule request (approve/reject)
   */
  async respondToRescheduleRequest(dto: RespondToRescheduleRequestDto) {
    const request =
      await this.prismaService.tenancy.sessionRescheduleRequest.findUnique({
        where: { id: dto.requestId },
        include: {
          session: {
            include: {
              consultant: true,
            },
          },
        },
      });

    if (!request) {
      throw new NotFoundException(
        `Reschedule request with ID ${dto.requestId} not found`,
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Reschedule request is already ${request.status}`,
      );
    }

    // Verify user has permission (must be consultant or admin)
    // In production, add admin check
    if (request.session.consultantId !== dto.respondedBy) {
      throw new BadRequestException(
        'Only the consultant can respond to reschedule requests',
      );
    }

    // Update request status
    const updatedRequest =
      await this.prismaService.tenancy.sessionRescheduleRequest.update({
        where: { id: dto.requestId },
        data: {
          status: dto.status,
          respondedBy: dto.respondedBy,
          respondedAt: new Date(),
          ...(dto.reason && {
            reason: `${request.reason || ''}\n\nResponse: ${dto.reason}`,
          }),
        },
        include: {
          session: true,
        },
      });

    // If approved, update session date
    if (dto.status === 'APPROVED') {
      const session = await this.prismaService.tenancy.session.findUnique({
        where: { id: request.sessionId },
      });

      if (session) {
        const previousDate = session.scheduledDate;
        await this.updateSessionDate(
          request.sessionId,
          request.requestedDate,
          request.requestedDateString,
        );

        // Emit reschedule event
        this.eventEmitter.emit(
          SESSION_EVENTS.SESSION_RESCHEDULE_NOTIFICATION,
          new SessionRescheduleEvent(
            request.sessionId,
            previousDate,
            request.requestedDate,
            session.clientId,
            session.consultantId,
            request.reason,
          ),
        );
      }
    }

    return updatedRequest;
  }

  /**
   * Update session date after reschedule approval
   */
  private async updateSessionDate(
    sessionId: string,
    newDate: Date,
    newDateString: string,
  ) {
    const session = await this.prismaService.tenancy.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    const changeLog: any[] = Array.isArray(session.changeLog)
      ? [...session.changeLog]
      : [];

    // Add reschedule entry to change log
    changeLog.push({
      type: 'RESCHEDULE',
      previousDate: session.scheduledDate,
      previousDateString: session.scheduledDateString,
      newDate,
      newDateString,
      timestamp: new Date(),
    });

    await this.prismaService.tenancy.session.update({
      where: { id: sessionId },
      data: {
        scheduledDate: newDate,
        scheduledDateString: newDateString,
        rescheduled: true,
        changeLog,
      },
    });

    this.logger.log(
      `Session ${sessionId} rescheduled from ${session.scheduledDateString} to ${newDateString}`,
    );
  }

  /**
   * Get reschedule requests for a session
   */
  async getSessionRescheduleRequests(sessionId: string) {
    return this.prismaService.tenancy.sessionRescheduleRequest.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get reschedule requests for a consultant
   */
  async getConsultantRescheduleRequests(consultantId: string) {
    const sessions = await this.prismaService.tenancy.session.findMany({
      where: { consultantId },
      select: { id: true },
    });

    const sessionIds = sessions.map((s) => s.id);

    return this.prismaService.tenancy.sessionRescheduleRequest.findMany({
      where: {
        sessionId: { in: sessionIds },
        status: 'PENDING',
      },
      include: {
        session: {
          include: {
            client: {
              include: {
                userProfile: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
