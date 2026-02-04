import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpStatus,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SessionsService } from '../services/sessions.service';
import { AvailableQuotaSessionsService } from '../services/available-quota.sessions.service';
import { ProviderAvailabilityService } from '../services/provider-availability.service';
import { CreateSessionsDto } from '../dtos/create-sessions.dto';
import { RescheduleSessionsDto } from '../dtos/reschedule-sessions.dto';
import { CancelSessionsDto } from '../dtos/cancel-sessions.dto';
import { UpdateAvailabilityDto } from '../dtos/update-availability.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { QueryFilter } from 'params/query-filter';
import { UserProfileType, UserType } from 'generated/prisma/enums';
import { SessionStatus } from 'generated/prisma/enums';

@Controller('sessions')
@ApiTags('Sessions')
@UseGuards(PermissionsGuard)
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly availableQuotaService: AvailableQuotaSessionsService,
    private readonly providerAvailabilityService: ProviderAvailabilityService,
  ) {}

  @Post('schedule')
  @AuthUserGuard([UserProfileType.CLIENT, UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.CREATED,
    message: 'Sessions scheduled successfully',
  })
  @ApiOperation({ summary: 'Schedule new sessions' })
  async schedule(@Body() dto: CreateSessionsDto) {
    return this.sessionsService.initializeSessionSchedule(dto);
  }

  @Get()
  @Response({ status: HttpStatus.OK, message: 'Sessions fetched successfully' })
  @ApiOperation({ summary: 'Get all sessions' })
  async findAll(
    @Query() paginationQuery: PaginationQuery,
    @Query() filter: Record<string, any>,
    @AuthUser() user?: User,
  ) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.sessionsService.getSessions(userId, filter, paginationQuery);
  }

  @Get('quota')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Available quota fetched successfully',
  })
  @ApiOperation({ summary: 'Get available session quota' })
  async getQuota(
    @Query('hmoId') hmoId?: string,
    @Query('hmoNumber') hmoNumber?: string,
    @AuthUser() user?: User,
  ) {
    if (!user) {
      throw new Error('User not found');
    }

    // Get client profile
    const clientProfile = await this.sessionsService['getClientProfile'](
      user.id,
    );
    if (!clientProfile) {
      throw new Error('Client profile not found');
    }

    return this.availableQuotaService.getAvailableSessionsQuota({
      clientUserId: clientProfile.id,
      hmoId,
      hmoNumber,
    });
  }

  @Get('booked-count')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Booked count fetched successfully',
  })
  @ApiOperation({ summary: 'Get booked sessions count' })
  async getBookedCount(@AuthUser() user?: User) {
    if (!user) {
      throw new Error('User not found');
    }

    const clientProfile = await this.sessionsService['getClientProfile'](
      user.id,
    );
    if (!clientProfile) {
      throw new Error('Client profile not found');
    }

    const sessions = await this.sessionsService.getSessions(
      user.id,
      {},
      { skip: 0, take: 0 },
    );
    const count = sessions?.totalRecords || 0;

    return { count };
  }

  @Post('reschedule')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Reschedule request created successfully',
  })
  @ApiOperation({ summary: 'Reschedule a session' })
  async reschedule(@Body() dto: RescheduleSessionsDto, @AuthUser() user: User) {
    const clientProfile = await this.sessionsService['getClientProfile'](
      user.id,
    );
    if (!clientProfile) {
      throw new Error('Client profile not found');
    }

    return this.sessionsService.rescheduleSession(dto, clientProfile.id);
  }

  @Post('cancel')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Session cancelled successfully',
  })
  @ApiOperation({ summary: 'Cancel a session' })
  async cancel(@Body() dto: CancelSessionsDto, @AuthUser() user: User) {
    const clientProfile = await this.sessionsService['getClientProfile'](
      user.id,
    );
    if (!clientProfile) {
      throw new Error('Client profile not found');
    }

    return this.sessionsService.cancelSession(dto, clientProfile.id);
  }

  @Patch(':id/status')
  @Response({
    status: HttpStatus.OK,
    message: 'Session status updated successfully',
  })
  @ApiOperation({ summary: 'Update session status (Admin only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: SessionStatus,
    @AuthUser() user?: User,
  ) {
    return this.sessionsService.updateSessionStatus(id, status, user?.id);
  }

  @Patch(':id/note')
  @AuthUserGuard([UserProfileType.CLIENT, UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.OK,
    message: 'Session note updated successfully',
  })
  @ApiOperation({ summary: 'Update session note (Client only)' })
  async updateNote(
    @Param('id') id: string,
    @Body('note') note: string,
    @AuthUser() user?: User,
  ) {
    return this.sessionsService.updateSessionNote(id, note, user?.id);
  }

  @Patch(':id/prescription-note')
  @AuthUserGuard([
    UserProfileType.CONSULTANT,
    UserType.ADMIN,
    UserType.SUPER_ADMIN,
  ])
  @Response({
    status: HttpStatus.OK,
    message: 'Prescription note updated successfully',
  })
  @ApiOperation({ summary: 'Update prescription note (Consultant only)' })
  async updatePrescriptionNote(
    @Param('id') id: string,
    @Body('prescriptionNote') prescriptionNote: string,
    @AuthUser() user?: User,
  ) {
    return this.sessionsService.updatePrescriptionNote(
      id,
      prescriptionNote,
      user?.id,
    );
  }

  @Patch(':id/session-note')
  @AuthUserGuard([
    UserProfileType.CONSULTANT,
    UserType.ADMIN,
    UserType.SUPER_ADMIN,
  ])
  @Response({
    status: HttpStatus.OK,
    message: 'Session note/report updated successfully',
  })
  @ApiOperation({ summary: 'Update session note/report (Consultant only)' })
  async updateSessionNoteReport(
    @Param('id') id: string,
    @Body('sessionNote') sessionNote: string,
    @AuthUser() user?: User,
  ) {
    return this.sessionsService.updateSessionNoteReport(
      id,
      sessionNote,
      user?.id,
    );
  }

  @Get('consultant')
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant sessions fetched successfully',
  })
  @ApiOperation({ summary: 'Get consultant sessions' })
  async getConsultantSessions(
    @QueryFilter() filter: Record<string, any>,
    @Query() paginationQuery: PaginationQuery,
    @Query('clientId') clientId?: string,
    @AuthUser() user?: User,
  ) {
    const whereFilter: any = { ...filter };

    if (user) {
      // Get consultant profile
      const consultantProfile = await this.sessionsService[
        'prismaService'
      ].tenancy.userProfileConsultant.findFirst({
        where: {
          userProfile: {
            userId: user.id,
          },
        },
        select: { id: true },
      });

      if (consultantProfile) {
        whereFilter.consultantId = consultantProfile.id;
      }
    }

    if (clientId) {
      whereFilter.clientId = clientId;
    }

    return this.sessionsService.getSessions(
      undefined,
      whereFilter,
      paginationQuery,
    );
  }

  @Get('consultant/:consultantId/stats')
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant stats fetched successfully',
  })
  @ApiOperation({ summary: 'Get consultant statistics' })
  async getConsultantStats(@Param('consultantId') consultantId: string) {
    return this.sessionsService.getConsultantStats(consultantId);
  }

  @Get('consultants/availability')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant availability fetched successfully',
  })
  @ApiOperation({ summary: 'Get consultant availability (for consultants)' })
  async getOwnAvailability(
    @AuthUser() user: User,
    @Query('date') date?: string,
  ) {
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Get consultant profile for the authenticated user
    const consultantProfile = await this.sessionsService[
      'prismaService'
    ].tenancy.userProfileConsultant.findFirst({
      where: {
        userProfile: {
          userId: user.id,
        },
      },
      select: { id: true },
    });

    if (!consultantProfile) {
      throw new NotFoundException('Consultant profile not found for user');
    }

    return this.providerAvailabilityService.getAvailability(
      consultantProfile.id,
      date,
    );
  }

  @Get('consultants/:consultantId/availability')
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant availability fetched successfully',
  })
  @ApiOperation({ summary: 'Get consultant availability (for clients)' })
  async getConsultantAvailability(
    @Param('consultantId') consultantId: string,
    @Query('date') date?: string,
    @Query('buffer') buffer?: number,
  ) {
    return this.providerAvailabilityService.getForProvider(
      consultantId,
      date,
      buffer,
    );
  }

  @Patch('consultants/availability')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant availability updated successfully',
  })
  @ApiOperation({ summary: 'Update consultant availability (for consultants)' })
  async updateAvailability(
    @Body() dto: UpdateAvailabilityDto,
    @AuthUser() user: User,
    @Query('consultantId') consultantId?: string,
  ) {
    if (!user) {
      throw new Error('User not found');
    }

    // If consultantId is provided, verify user is admin or the consultant
    let finalConsultantId = consultantId;

    if (!finalConsultantId) {
      // Get consultant profile for the authenticated user
      const consultantProfile = await this.sessionsService[
        'prismaService'
      ].tenancy.userProfileConsultant.findFirst({
        where: {
          userProfile: {
            userId: user.id,
          },
        },
        select: { id: true },
      });

      if (!consultantProfile) {
        throw new Error('Consultant profile not found for user');
      }

      finalConsultantId = consultantProfile.id;
    } else {
      // Verify user has permission (admin or same consultant)
      if (user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN) {
        const consultantProfile = await this.sessionsService[
          'prismaService'
        ].tenancy.userProfileConsultant.findFirst({
          where: {
            id: finalConsultantId,
            userProfile: {
              userId: user.id,
            },
          },
          select: { id: true },
        });

        if (!consultantProfile) {
          throw new Error(
            'Unauthorized: Cannot update availability for another consultant',
          );
        }
      }
    }

    return this.providerAvailabilityService.updateAvailability(
      finalConsultantId,
      dto,
    );
  }

  @Patch('consultants/:consultantId/availability')
  @AuthUserGuard([
    UserProfileType.CONSULTANT,
    UserType.ADMIN,
    UserType.SUPER_ADMIN,
  ])
  @Response({
    status: HttpStatus.OK,
    message: 'Consultant availability updated successfully',
  })
  @ApiOperation({
    summary: 'Update consultant availability by ID (for consultants/admins)',
  })
  async updateAvailabilityById(
    @Param('consultantId') consultantId: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.providerAvailabilityService.updateAvailability(
      consultantId,
      dto,
    );
  }

  @Get('price/:sessionType')
  @Response({
    status: HttpStatus.OK,
    message: 'Session price fetched successfully',
  })
  @ApiOperation({ summary: 'Get session price (Public)' })
  getSessionPrice(@Param('sessionType') sessionType: string) {
    // This would come from a pricing service/database
    const prices: Record<string, number> = {
      INDIVIDUAL: 5000,
      COUPLE: 8000,
      CONSULTATION: 10000,
    };

    return {
      sessionType,
      price: prices[sessionType] || 5000,
      currency: 'NGN',
    };
  }

  @Post('verify-payment/:reference')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Payment verified and sessions created successfully',
  })
  @ApiOperation({
    summary: 'Verify session payment and complete session creation',
    description:
      'Call this endpoint after payment is made to verify payment and create sessions. Can also be called manually if webhook fails.',
  })
  async verifyPayment(@Param('reference') reference: string) {
    return this.sessionsService.verifySessionPayment(reference);
  }

  @Get(':id/meeting-token')
  @AuthUserGuard([
    UserProfileType.CLIENT,
    UserProfileType.CONSULTANT,
    UserType.ADMIN,
    UserType.SUPER_ADMIN,
  ])
  @Response({
    status: HttpStatus.OK,
    message: 'Meeting token fetched successfully',
  })
  @ApiOperation({ summary: 'Get meeting token for a session' })
  async getMeetingToken(
    @Param('id') sessionId: string,
    @AuthUser() user?: User,
  ) {
    if (!user) {
      throw new BadRequestException('User must be authenticated');
    }

    const token = await this.sessionsService.getSessionMeetingToken(
      sessionId,
      user.id,
    );

    if (!token) {
      throw new NotFoundException('Meeting token not found for this session');
    }

    return { token };
  }

  @Get(':id')
  @Response({ status: HttpStatus.OK, message: 'Session fetched successfully' })
  @ApiOperation({ summary: 'Get a single session by ID' })
  async findOne(@Param('id') id: string, @AuthUser() user?: User) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.sessionsService.getSession(id, userId);
  }
}
