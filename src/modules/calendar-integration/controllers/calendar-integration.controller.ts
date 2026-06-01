import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CalendarIntegrationService } from '../services/calendar-integration.service';
import { ConnectCalendarDto } from '../dtos/connect-calendar.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import type { User } from 'generated/prisma/client';
import { PermissionsGuard } from 'src/guards/permission.guard';

@Controller('calendar-integration')
@ApiTags('Calendar Integration')
@UseGuards(PermissionsGuard)
export class CalendarIntegrationController {
  constructor(
    private readonly calendarIntegrationService: CalendarIntegrationService,
  ) {}

  @Get('auth-url')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Authorization URL generated successfully',
  })
  @ApiOperation({ summary: 'Get calendar OAuth authorization URL' })
  getAuthUrl(
    @Query('provider') provider: 'google' = 'google',
    @Query('state') state: string,
    @AuthUser() user: User,
  ) {
    return this.calendarIntegrationService.getAuthUrl(user.id, provider, state);
  }

  @Post('connect')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.CREATED,
    message: 'Calendar connected successfully',
  })
  @ApiOperation({
    summary: 'Connect calendar by exchanging authorization code',
  })
  async connectCalendar(
    @Body() dto: ConnectCalendarDto,
    @AuthUser() user: User,
  ) {
    return this.calendarIntegrationService.connectCalendar(user.id, dto);
  }

  @Get()
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Calendar integrations fetched successfully',
  })
  @ApiOperation({ summary: 'Get user calendar integrations' })
  async getIntegrations(
    @Query('provider') provider?: 'google' | 'outlook' | 'apple',
    @AuthUser() user?: User,
  ) {
    if (!user) {
      throw new Error('User not found');
    }

    return this.calendarIntegrationService.getIntegration(user.id, provider);
  }

  @Post('disconnect/:provider')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Calendar disconnected successfully',
  })
  @ApiOperation({ summary: 'Disconnect calendar integration' })
  async disconnectCalendar(
    @Param('provider') provider: 'google' | 'outlook' | 'apple',
    @AuthUser() user?: User,
  ) {
    if (!user) {
      throw new Error('User not found');
    }

    return this.calendarIntegrationService.disconnectCalendar(
      user.id,
      provider,
    );
  }

  @Delete(':provider')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Calendar integration deleted successfully',
  })
  @ApiOperation({ summary: 'Delete calendar integration permanently' })
  async deleteIntegration(
    @Param('provider') provider: 'google' | 'outlook' | 'apple',
    @AuthUser() user?: User,
  ) {
    if (!user) {
      throw new Error('User not found');
    }

    return this.calendarIntegrationService.deleteIntegration(user.id, provider);
  }
}
