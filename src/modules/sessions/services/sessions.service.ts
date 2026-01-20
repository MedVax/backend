import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { PaystackService } from 'modules/services/paystack-service';
import { CreateSessionsDto } from '../dtos/create-sessions.dto';
import { RescheduleSessionsDto } from '../dtos/reschedule-sessions.dto';
import { CancelSessionsDto } from '../dtos/cancel-sessions.dto';
import { AvailableQuotaSessionsService } from './available-quota.sessions.service';
import { ProviderAvailabilityService } from './provider-availability.service';
import { MeetingService } from './meeting.service';
import { GiftSessionsService } from './gift.sessions.service';
import { RescheduleRequestsSessionsService } from './reschedule-requests.sessions.service';
import {
  ERROR_MESSAGES,
  SESSION_BUFFER_HOURS,
  SESSION_EVENTS,
} from '../constants/sessions.constant';
import {
  SessionStatus,
  SessionType,
  OrganizationSponsor,
  TransactionType,
} from 'generated/prisma/enums';
import { QueryFilter, QueryOptions } from 'libs/url-to-db-query';
import { randomUUID } from 'crypto';
import type { User } from 'generated/prisma/client';
import {
  SessionCreationEvent,
  SessionCancellationEvent,
} from '../events/sessions.event';
import { TransactionsService } from 'modules/transactions/services/transactions.service';
import { TransactionStatus } from 'generated/prisma/enums';
import { format, parseISO } from 'date-fns';

@Injectable()
export class SessionsService {
  private logger = new Logger(SessionsService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private eventEmitter: EventEmitter2,
    private paystackService: PaystackService,
    private availableQuotaService: AvailableQuotaSessionsService,
    private providerAvailabilityService: ProviderAvailabilityService,
    private meetingService: MeetingService,
    private giftSessionsService: GiftSessionsService,
    private rescheduleRequestsService: RescheduleRequestsSessionsService,
    @Inject(forwardRef(() => TransactionsService))
    private transactionsService: TransactionsService,
  ) {}

  /**
   * Initialize session schedule - Entry point for booking flow
   */
  async initializeSessionSchedule(dto: CreateSessionsDto): Promise<{
    sessions: any[] | null;
    paymentLink: string | null;
  }> {
    await this.validateUsersAndSession(dto.consultantId, dto.clientId);

    const clientProfile =
      await this.prismaService.tenancy.userProfileClient.findUnique({
        where: { id: dto.clientId },
        include: {
          userProfile: {
            include: {
              user: true,
            },
          },
        },
      });

    if (!clientProfile) {
      throw new NotFoundException(
        'Client profile not found. Please create a client profile first.',
      );
    }

    //check if consultant is assigned to client
    const consultantAssignment =
      await this.prismaService.tenancy.userProfileClient.findUnique({
        where: { id: dto.clientId, userProfileConsultantId: dto.consultantId },
      });

    if (!consultantAssignment) {
      throw new NotFoundException(
        `Consultant with ID ${dto.consultantId} not assigned to client with ID ${dto.clientId}`,
      );
    }

    // Get consultant and use their pricing
    const consultant =
      await this.prismaService.tenancy.userProfileConsultant.findUnique({
        where: { id: dto.consultantId },
        select: {
          id: true,
          rate: true,
        },
      });

    if (!consultant) {
      throw new NotFoundException(
        `Consultant with ID ${dto.consultantId} not found`,
      );
    }

    // Use consultant's rate, fallback to default pricing if rate is not set
    const sessionPrice =
      consultant.rate || this.getSessionPrice(dto.sessionType);

    // Check if all requested slots are available
    const unavailableSlots: string[] = [];
    for (const dateString of dto.dates) {
      const isAvailable =
        await this.providerAvailabilityService.isSlotAvailable(
          dto.consultantId,
          dateString,
          SESSION_BUFFER_HOURS,
        );

      if (!isAvailable) {
        unavailableSlots.push(dateString);
      }
    }

    if (unavailableSlots.length > 0) {
      throw new BadRequestException(
        `The following time slots are not available: ${unavailableSlots?.map((slot) => format(parseISO(slot), 'Pp')).join(', ')}. Please select different time slots.`,
      );
    }

    //  Calculate available quota
    const quota = await this.availableQuotaService.getAvailableSessionsQuota({
      clientUserId: clientProfile.id,
      hmoId: dto.hmoId,
      hmoNumber: dto.hmoNumber,
      sessionType: dto.sessionType,
    });

    // Determine if payment is needed
    const sessionsCount = dto.dates.length;
    const needsPayment =
      quota.sponsor === OrganizationSponsor.CLIENT &&
      !quota.isUnlimited &&
      quota.availableSessionsCount < sessionsCount;

    // If payment needed, initialize payment
    if (needsPayment) {
      const paymentResult = await this.initializeSessionPayment(
        clientProfile.userProfile?.user,
        dto,
        sessionPrice,
        sessionsCount,
      );
      return {
        sessions: null,
        paymentLink: paymentResult.paymentLink,
      };
    }

    // Create sessions directly
    const sessions = await this.scheduleSessions(dto, SESSION_BUFFER_HOURS);

    return {
      sessions,
      paymentLink: null,
    };
  }

  /**
   * Schedule sessions - Creates sessions after validation
   */
  async scheduleSessions(
    dto: CreateSessionsDto,
    buffer?: number,
  ): Promise<any[]> {
    const bufferHours = buffer || SESSION_BUFFER_HOURS;

    // Validate client and consultant
    await this.validateUsersAndSession(dto.consultantId, dto.clientId);

    // Get client and consultant profiles
    const client =
      await this.prismaService.tenancy.userProfileClient.findUnique({
        where: { id: dto.clientId },
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
      throw new NotFoundException(`Client with ID ${dto.clientId} not found`);
    }

    const consultant =
      await this.prismaService.tenancy.userProfileConsultant.findUnique({
        where: { id: dto.consultantId },
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
      throw new NotFoundException(
        `Consultant with ID ${dto.consultantId} not found`,
      );
    }

    // Check if consultant supports the session type
    // This would check consultant's specializations in production
    // For now, we'll just verify consultant exists

    // Count existing sessions before booking
    const sessionCountBefore = await this.prismaService.tenancy.session.count({
      where: {
        clientId: dto.clientId,
        sessionType: SessionType.INDIVIDUAL,
        deleted: false,
      },
    });

    const coupleSessionCountBefore =
      await this.prismaService.tenancy.session.count({
        where: {
          clientId: dto.clientId,
          sessionType: SessionType.COUPLE,
          deleted: false,
        },
      });

    // Create sessions in transaction
    const sessions = await this.prismaService.tenancy.$transaction(
      async (tx) => {
        const createdSessions: any[] = [];

        for (const dateString of dto.dates) {
          // Validate slot availability
          const isAvailable =
            await this.providerAvailabilityService.isSlotAvailable(
              dto.consultantId,
              dateString,
              bufferHours,
            );

          if (!isAvailable) {
            throw new BadRequestException(ERROR_MESSAGES.TIME_SLOT_UNAVAILABLE);
          }

          // Check if slot is already booked
          const existingSession = await tx.session.findUnique({
            where: {
              scheduledDateString: dateString,
            },
          });

          if (existingSession && !existingSession.deleted) {
            throw new BadRequestException(ERROR_MESSAGES.TIME_SLOT_UNAVAILABLE);
          }

          // Create meeting
          const meeting = await this.meetingService.createMeeting(
            `Session with ${consultant.userProfile?.user?.firstName || 'Consultant'}`,
          );

          // Determine session status
          let status = SessionStatus.PENDING;
          if (
            dto.paidBy === OrganizationSponsor.HMO ||
            dto.paidBy === OrganizationSponsor.ORG
          ) {
            // Check quota
            const quota =
              await this.availableQuotaService.getAvailableSessionsQuota({
                clientUserId: dto.clientId,
                hmoId: dto.hmoId,
                hmoNumber: dto.hmoNumber,
                sessionType: dto.sessionType,
              });

            if (
              !quota.isUnlimited &&
              quota.availableSessionsCount < dto.dates.length
            ) {
              status = SessionStatus.PENDING;
            }
          }

          // Create session
          const scheduledDate = dateString;
          const session = await tx.session.create({
            data: {
              id: `session-${Date.now()}-${randomUUID().split('-')[0]}`,
              clientId: dto.clientId,
              consultantId: dto.consultantId,
              status,
              sessionType: dto.sessionType,
              scheduledDate,
              scheduledDateString: dateString,
              meetingId: meeting?.id || null,
              meetingUrl: meeting?.authToken
                ? `https://app.dyte.io/${meeting?.id}`
                : null,
              clientTimezone: dto.clientTimezone,
              note: dto?.note || '',
              paidBy: dto.paidBy,
              subscriptionId: dto.subscriptionId || null,
              hmoId: dto.hmoId || null,
              hmoNumber: dto.hmoNumber || null,
            },
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

          // Apply gift session if requested
          if (dto.applyGift) {
            const gift = await this.giftSessionsService.getUserGifts(
              dto.clientId,
            );
            if (gift.length > 0 && gift[0].sessionsLeft > 0) {
              await this.giftSessionsService.applyGiftSession(
                gift[0].id,
                session.id,
              );
            }
          }

          // Create session activity record
          await tx.sessionActivity.create({
            data: {
              id: `activity-${Date.now()}-${randomUUID().split('-')[0]}`,
              sessionId: session.id,
              activityType: 'CREATED',
              userId: client.userProfile?.user?.id || null,
            },
          });

          // Handle couple session participants
          if (dto.sessionType === SessionType.COUPLE && dto.participants) {
            for (const participant of dto.participants) {
              // Check if participant is existing user
              const participantUser = await tx.user.findUnique({
                where: { email: participant.email },
                select: { id: true },
              });

              if (participantUser) {
                // Create session participant
                await tx.sessionParticipant.create({
                  data: {
                    id: `participant-${Date.now()}-${randomUUID().split('-')[0]}`,
                    sessionId: session.id,
                    userId: participantUser.id,
                    email: participant.email,
                    name: participant.name,
                    joined: false,
                  },
                });
              } else {
                // Create session invitee
                await tx.sessionInvitee.create({
                  data: {
                    id: `invitee-${Date.now()}-${randomUUID().split('-')[0]}`,
                    sessionId: session.id,
                    email: participant.email,
                    name: participant.name,
                    token: `invite-${Date.now()}-${randomUUID()}`,
                    accepted: false,
                  },
                });

                // TODO: Send invitation email
                // await this.mailService.sendSessionInvitation({...});
              }
            }
          }

          createdSessions.push(session);
        }

        return createdSessions;
      },
    );

    // Emit SESSION_CREATED event
    this.eventEmitter.emit(
      SESSION_EVENTS.SESSION_CREATED,
      new SessionCreationEvent(
        dto,
        sessions,
        sessionCountBefore,
        coupleSessionCountBefore,
        dto.clientId,
      ),
    );

    // Update client hasBookedSession flag
    if (!client.hasBookedSession) {
      await this.prismaService.tenancy.userProfileClient.update({
        where: { id: dto.clientId },
        data: { hasBookedSession: true },
      });
    }

    return sessions;
  }

  /**
   * Create a single session (internal helper)
   */
  private async createSession(
    clientId: string,
    consultantId: string,
    scheduledDate: Date,
    scheduledDateString: string,
    sessionType: SessionType,
    options: {
      clientTimezone?: string;
      note?: string;
      paidBy?: OrganizationSponsor;
      subscriptionId?: string;
      giftId?: string;
      hmoId?: string;
      hmoNumber?: string;
      meetingId?: string;
      meetingUrl?: string;
    } = {},
  ): Promise<any> {
    return this.prismaService.tenancy.session.create({
      data: {
        id: `session-${Date.now()}-${randomUUID().split('-')[0]}`,
        clientId,
        consultantId,
        status: SessionStatus.PENDING,
        sessionType,
        scheduledDate,
        scheduledDateString,
        meetingId: options.meetingId || null,
        meetingUrl: options.meetingUrl || null,
        clientTimezone: options.clientTimezone || null,
        note: options.note || null,
        paidBy: options.paidBy || OrganizationSponsor.CLIENT,
        subscriptionId: options.subscriptionId || null,
        giftId: options.giftId || null,
        hmoId: options.hmoId || null,
        hmoNumber: options.hmoNumber || null,
      },
      include: {
        client: true,
        consultant: true,
      },
    });
  }

  /**
   * Reschedule session
   */
  async rescheduleSession(dto: RescheduleSessionsDto, clientId: string) {
    // Create reschedule request
    const request =
      await this.rescheduleRequestsService.createRescheduleRequest({
        sessionId: dto.sessionId,
        requestedBy: clientId,
        requestedDate: new Date(dto.date),
        requestedDateString: new Date(dto.date).toISOString(),
        reason: dto.reason,
      });

    return request;
  }

  /**
   * Cancel session
   */
  async cancelSession(dto: CancelSessionsDto, clientId: string) {
    const session = await this.prismaService.tenancy.session.findUnique({
      where: { id: dto.sessionId },
      include: {
        client: true,
        consultant: true,
      },
    });

    if (!session) {
      throw new NotFoundException(ERROR_MESSAGES.SESSION_UNAVAILABLE);
    }

    // Verify user has permission (must be client)
    if (session.clientId !== clientId) {
      throw new BadRequestException(
        'Only the client can cancel their own session',
      );
    }

    // Verify session can be cancelled
    if (
      session.status === SessionStatus.COMPLETED ||
      session.status === SessionStatus.CANCELED ||
      session.status === SessionStatus.DECLINED
    ) {
      throw new BadRequestException(
        `Cannot cancel session with status: ${session.status}`,
      );
    }

    // Update change log
    const changeLog: any[] = Array.isArray(session.changeLog)
      ? [...session.changeLog]
      : [];

    changeLog.push({
      type: 'CANCEL',
      previousStatus: session.status,
      newStatus: SessionStatus.CANCELED,
      reason: dto.note,
      timestamp: new Date(),
    });

    // Update session
    const updatedSession = await this.prismaService.tenancy.session.update({
      where: { id: dto.sessionId },
      data: {
        status: SessionStatus.CANCELED,
        deleted: true,
        deletedAt: new Date(),
        changeLog,
      },
      include: {
        client: true,
        consultant: true,
      },
    });

    // Cancel meeting if exists
    if (session.meetingId) {
      await this.meetingService.endMeeting(session.meetingId);
    }

    // Emit cancellation event
    this.eventEmitter.emit(
      SESSION_EVENTS.SESSION_CANCELLATION_NOTIFICATION,
      new SessionCancellationEvent(
        dto.sessionId,
        session.clientId,
        session.consultantId,
        dto.note,
      ),
    );

    this.logger.log(`Session ${dto.sessionId} cancelled by client ${clientId}`);

    return updatedSession;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    userId?: string,
  ) {
    const session = await this.prismaService.tenancy.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(ERROR_MESSAGES.SESSION_UNAVAILABLE);
    }

    // Update change log
    const changeLog: any[] = Array.isArray(session.changeLog)
      ? [...session.changeLog]
      : [];

    changeLog.push({
      type: 'STATUS_UPDATE',
      previousStatus: session.status,
      newStatus: status,
      updatedBy: userId,
      timestamp: new Date(),
    });

    const updatedSession = await this.prismaService.tenancy.session.update({
      where: { id: sessionId },
      data: {
        status,
        changeLog,
      },
      include: {
        client: true,
        consultant: true,
      },
    });

    this.logger.log(
      `Session ${sessionId} status updated from ${session.status} to ${status}`,
    );

    return updatedSession;
  }

  /**
   * Get sessions with filters
   */
  async getSessions(
    userId?: string,
    filter?: QueryFilter<any>,
    options?: QueryOptions<any>,
  ) {
    const whereFilter: any = { ...filter, deleted: false };

    if (userId) {
      // Get user's client or consultant profile
      const clientProfile =
        await this.prismaService.tenancy.userProfileClient.findFirst({
          where: {
            userProfile: {
              userId,
            },
          },
          select: { id: true },
        });

      const consultantProfile =
        await this.prismaService.tenancy.userProfileConsultant.findFirst({
          where: {
            userProfile: {
              userId,
            },
          },
          select: { id: true },
        });

      if (clientProfile) {
        whereFilter.clientId = clientProfile.id;
      } else if (consultantProfile) {
        whereFilter.consultantId = consultantProfile.id;
      }
    }

    const result =
      await this.prismaService.tenancy.session.findFirstWithUrlQuery(
        whereFilter,
        options,
      );

    if (result) {
      return this.prismaService.tenancy.session.findUnique({
        where: { id: result.id },
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
          participants: true,
          invitees: true,
        },
      });
    }

    if (!Array.isArray(result) && result.data) {
      const ids = result.data.map((s: any) => s.id);
      const data = await this.prismaService.tenancy.session.findMany({
        where: { id: { in: ids } },
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
          participants: true,
          invitees: true,
        },
        orderBy: {
          scheduledDate: 'asc',
        },
      });
      return { ...result, data };
    }

    return result;
  }

  /**
   * Validate users and session compatibility
   */
  async validateUsersAndSession(
    consultantId: string,
    clientId: string,
  ): Promise<void> {
    // Verify consultant exists and is active
    const consultant =
      await this.prismaService.tenancy.userProfileConsultant.findUnique({
        where: { id: consultantId },
        include: {
          userProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  status: true,
                  email: true,
                },
              },
            },
          },
        },
      });

    if (!consultant) {
      throw new NotFoundException(
        `Consultant with ID ${consultantId} not found`,
      );
    }

    if (consultant.deletedAt) {
      throw new BadRequestException(
        ERROR_MESSAGES.THERAPIST_RESTRICTED_FROM_BEING_BOOKED,
      );
    }

    if (consultant.userProfile?.user?.status !== 'ACTIVE') {
      throw new BadRequestException(
        ERROR_MESSAGES.THERAPIST_RESTRICTED_FROM_BEING_BOOKED,
      );
    }

    // Verify client exists and is active
    const client =
      await this.prismaService.tenancy.userProfileClient.findUnique({
        where: { id: clientId },
        include: {
          userProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  status: true,
                  email: true,
                },
              },
            },
          },
        },
      });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    if (client.deletedAt) {
      throw new BadRequestException(
        ERROR_MESSAGES.ACCOUNT_RESTRICTED_FROM_BOOKING,
      );
    }

    if (client.userProfile?.user?.status !== 'ACTIVE') {
      throw new BadRequestException(
        ERROR_MESSAGES.ACCOUNT_RESTRICTED_FROM_BOOKING,
      );
    }

    // Check if consultant has set availability
    if (!consultant.hasSetAvailability) {
      throw new BadRequestException(
        'Consultant has not set their availability',
      );
    }
  }

  /**
   * Get client profile for a user
   */
  async getClientProfile(userId: string) {
    return this.prismaService.tenancy.userProfileClient.findFirst({
      where: {
        userProfile: {
          userId,
        },
        deletedAt: null,
      },
      include: {
        userProfile: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  /**
   * Get session price (placeholder - should come from pricing service)
   */
  private getSessionPrice(sessionType: SessionType): number {
    // In production, this would query a pricing table or service
    // For now, return default prices
    const prices: Record<SessionType, number> = {
      [SessionType.INDIVIDUAL]: 5000, // 5000 NGN (50.00 in major units)
      [SessionType.COUPLE]: 8000, // 8000 NGN (80.00 in major units)
      [SessionType.CONSULTATION]: 10000, // 10000 NGN (100.00 in major units)
    };

    return prices[sessionType] || 5000;
  }

  /**
   * Initialize payment for sessions
   */
  private async initializeSessionPayment(
    user: User,
    dto: CreateSessionsDto,
    sessionPrice: number,
    sessionsCount: number,
  ): Promise<{ paymentLink: string }> {
    const totalAmount = sessionPrice * sessionsCount;
    const reference = `session-${Date.now()}-${randomUUID().split('-')[0]}`;

    // Create transaction record FIRST (in PENDING state)
    // This ensures we have a transaction record even if Paystack call fails
    let transactionRecord;
    try {
      transactionRecord = await this.transactionsService.create({
        userId: user.id,
        type: TransactionType.SESSION as any,
        reference: `session-booking-${reference}`,
        providerReference: reference, // Will update with actual provider reference after Paystack call
        provider: 'paystack',
        amount: totalAmount,
        currency: 'NGN',
        description: `Payment for ${sessionsCount} session(s) with consultant`,
        metadata: {
          type: 'session_booking',
          sessionType: dto.sessionType,
          sessionsCount,
          consultantId: dto.consultantId,
          clientId: dto.clientId,
          dates: dto.dates,
          clientTimezone: dto.clientTimezone,
          paidBy: dto.paidBy,
          hmoId: dto.hmoId,
          hmoNumber: dto.hmoNumber,
          subscriptionId: dto.subscriptionId,
          applyGift: dto.applyGift,
          couponId: dto.couponId,
          redirectUrl: dto.redirectUrl,
          participants: dto.participants,
          note: dto.note,
        },
        customerEmail: user.email,
        customerName: `${user.firstName} ${user.lastName}`,
      });
    } catch (error) {
      this.logger.error(
        error,
        `Failed to create transaction record for session booking: ${error.message}`,
      );
      throw new BadRequestException('Failed to initialize payment transaction');
    }

    // Initialize payment with Paystack
    let paymentLink;
    let providerReference = reference;
    try {
      const [transaction, paymentLinkResponse] =
        await this.paystackService.initBilling({
          reference,
          customer: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          amount: totalAmount / 100, // Convert from kobo to naira
          currencyCode: 'NGN',
          metadata: {
            type: 'session_booking',
            sessionType: dto.sessionType,
            sessionsCount,
            consultantId: dto.consultantId,
            dates: dto.dates,
          },
          returnUrl:
            dto.redirectUrl ||
            `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sessions`,
        });

      providerReference = transaction.reference || reference;
      paymentLink = paymentLinkResponse;

      // Update transaction with provider reference and response
      // Use Prisma directly to update providerReference (not in UpdateTransactionDto)
      await this.prismaService.tenancy.transaction.update({
        where: { id: transactionRecord.id },
        data: {
          providerReference,
          providerResponse: transaction,
          providerMetadata: {
            paymentLink: paymentLink.authorization_url,
          },
          paymentChannel: paymentLink.channels?.[0],
        },
      });
    } catch (error) {
      console.log('error', error);
      // If Paystack call fails, update transaction status to FAILED
      this.logger.error(
        `Failed to initialize Paystack payment: ${error.message}`,
      );
      try {
        await this.transactionsService.update(transactionRecord.id, {
          status: TransactionStatus.FAILED,
          errorMessage: error.message || 'Failed to initialize payment',
          failedAt: new Date(),
        });
      } catch (updateError) {
        this.logger.error(
          `Failed to update transaction status after payment failure: ${updateError.message}`,
        );
      }
      throw new BadRequestException(
        `Failed to initialize payment: ${error.message}`,
      );
    }

    return {
      paymentLink: paymentLink.authorization_url,
    };
  }

  /**
   * Verify session payment and complete session creation
   * This is called after payment is successful (via webhook or manual verification)
   */
  async verifySessionPayment(reference: string): Promise<any[]> {
    // Find transaction by provider reference
    const transaction =
      await this.transactionsService.findByProviderReference(reference);

    if (!transaction) {
      throw new NotFoundException(
        `Transaction not found for reference: ${reference}`,
      );
    }

    // Check if transaction is for session booking
    const metadata = (transaction.metadata || {}) as Record<string, any>;
    if (metadata.type !== 'session_booking') {
      throw new BadRequestException('Transaction is not for session booking');
    }

    // Verify payment with Paystack
    const paystackTransaction =
      await this.paystackService.getBillingMethod(reference);

    const paymentStatus =
      paystackTransaction.status === 'success'
        ? TransactionStatus.SUCCESS
        : TransactionStatus.FAILED;

    // Update transaction status
    await this.transactionsService.updateByProviderReference(reference, {
      status: paymentStatus,
      providerResponse: paystackTransaction,
      completedAt:
        paymentStatus === TransactionStatus.SUCCESS ? new Date() : undefined,
      failedAt:
        paymentStatus === TransactionStatus.FAILED ? new Date() : undefined,
    });

    // If payment failed, throw error
    if (paymentStatus === TransactionStatus.FAILED) {
      throw new BadRequestException('Payment verification failed');
    }

    // Extract session booking details from transaction metadata
    const sessionBookingDto: CreateSessionsDto = {
      consultantId: metadata.consultantId,
      clientId: metadata.clientId, // We need to get this from transaction userId
      dates: metadata.dates,
      sessionType: metadata.sessionType,
      clientTimezone: metadata.clientTimezone || 'Africa/Lagos',
      paidBy: metadata.paidBy || OrganizationSponsor.CLIENT,
      hmoId: metadata.hmoId,
      hmoNumber: metadata.hmoNumber,
      subscriptionId: metadata.subscriptionId,
      applyGift: metadata.applyGift || false,
      couponId: metadata.couponId,
      redirectUrl: metadata.redirectUrl,
      participants: metadata.participants,
      note: metadata.note,
    };

    // Get clientId from transaction userId (we need to find client profile)
    if (!sessionBookingDto.clientId && transaction.userId) {
      const clientProfile =
        await this.prismaService.tenancy.userProfileClient.findFirst({
          where: {
            userProfile: {
              userId: transaction.userId,
            },
            deletedAt: null,
          },
        });

      if (!clientProfile) {
        throw new NotFoundException(
          'Client profile not found for transaction user',
        );
      }

      sessionBookingDto.clientId = clientProfile.id;
    }

    // Check if sessions were already created (idempotency check)
    const existingSessions = await this.prismaService.tenancy.session.findMany({
      where: {
        transactions: {
          some: {
            providerReference: reference,
          },
        },
      },
    });

    if (existingSessions.length > 0) {
      this.logger.log(
        `Sessions already created for transaction ${reference}. Returning existing sessions.`,
      );
      return existingSessions;
    }

    // Create sessions
    const sessions = await this.scheduleSessions(
      sessionBookingDto,
      SESSION_BUFFER_HOURS,
    );

    // Link transaction to sessions (update the first session's transaction)
    // Note: Multiple sessions share the same transaction for a single payment
    if (transaction.id && sessions.length > 0) {
      await this.prismaService.tenancy.transaction.update({
        where: { id: transaction.id },
        data: {
          sessionId: sessions[0].id, // Link to first session
        },
      });
    }

    this.logger.log(
      `Sessions created successfully after payment verification: ${reference}. Created ${sessions.length} session(s).`,
    );

    return sessions;
  }
}
