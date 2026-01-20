import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { CalendarService } from 'modules/sessions/services/calendar.service';
import { CalendarCredentials } from 'modules/sessions/services/calendar.service';
import { ConnectCalendarDto } from '../dtos/connect-calendar.dto';
import { UpdateCalendarCredentialsDto } from '../dtos/update-calendar-credentials.dto';
import { AesEncryptionService } from 'services/aesEcryption.service';
import { GoogleCalendarService } from 'src/services/google-calendar.service';

@Injectable()
export class CalendarIntegrationService {
  private logger = new Logger(CalendarIntegrationService.name);

  constructor(
    private prismaService: PrismaTenancyService,
    private calendarService: CalendarService,
    private encryptionService: AesEncryptionService,
    private googleCalendarService: GoogleCalendarService,
  ) {}

  /**
   * Get authorization URL for calendar provider
   */
  getAuthUrl(
    userId: string,
    provider: 'google',
    redirectUri: string,
  ): { authUrl: string } {
    if (provider === 'google') {
      const authUrl = this.googleCalendarService.getAuthUrl(redirectUri);
      return { authUrl };
    }

    throw new BadRequestException(
      `Provider ${provider as any} is not yet supported`,
    );
  }

  /**
   * Connect calendar by exchanging authorization code for tokens
   */
  async connectCalendar(userId: string, dto: ConnectCalendarDto) {
    const { provider, code } = dto;

    const user = await this.prismaService.tenancy.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    let credentials: CalendarCredentials | null = null;

    if (provider === 'google') {
      credentials = await this.googleCalendarService.getTokens(code);
    }

    if (!credentials) {
      throw new BadRequestException(
        'Failed to obtain calendar credentials from provider',
      );
    }

    // Check if integration already exists
    const existing =
      await this.prismaService.tenancy.calendarIntegration.findUnique({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
      });

    const integrationData = {
      provider,
      accessToken: this.encryptionService.encrypt(credentials.accessToken),
      refreshToken: credentials.refreshToken
        ? this.encryptionService.encrypt(credentials.refreshToken)
        : null,
      tokenExpiry: credentials.expiryDate
        ? new Date(credentials.expiryDate)
        : null,
      isConnected: true,
      providerEmail: user.email,
      calendarId: 'primary', // Default for Google Calendar
      lastSyncedAt: new Date(),
    };

    if (existing) {
      // Update existing integration
      const updated =
        await this.prismaService.tenancy.calendarIntegration.update({
          where: { id: existing.id },
          data: integrationData,
        });

      this.logger.log(
        `Calendar integration updated for user ${userId}, provider: ${provider}`,
      );

      return {
        id: updated.id,
        provider: updated.provider,
        isConnected: updated.isConnected,
        providerEmail: updated.providerEmail,
        connectedAt: updated.updatedAt,
      };
    } else {
      // Create new integration
      const created =
        await this.prismaService.tenancy.calendarIntegration.create({
          data: {
            userId,
            ...integrationData,
          },
        });

      this.logger.log(
        `Calendar integration created for user ${userId}, provider: ${provider}`,
      );

      return {
        id: created.id,
        provider: created.provider,
        isConnected: created.isConnected,
        providerEmail: created.providerEmail,
        connectedAt: created.createdAt,
      };
    }
  }

  /**
   * Get calendar integration for user
   */
  async getIntegration(
    userId: string,
    provider?: 'google' | 'outlook' | 'apple',
  ) {
    const where: any = { userId, isConnected: true };

    if (provider) {
      where.provider = provider;
    }

    const integrations =
      await this.prismaService.tenancy.calendarIntegration.findMany({
        where,
        select: {
          id: true,
          provider: true,
          isConnected: true,
          providerEmail: true,
          calendarId: true,
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
          // Don't return tokens for security
        },
      });

    return integrations;
  }

  /**
   * Get decrypted credentials for calendar operations
   */
  async getCredentials(
    userId: string,
    provider: 'google' | 'outlook' | 'apple',
  ): Promise<CalendarCredentials | null> {
    const integration =
      await this.prismaService.tenancy.calendarIntegration.findUnique({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
      });

    if (!integration || !integration.isConnected) {
      return null;
    }

    // Check if token needs refresh
    const needsRefresh =
      integration.tokenExpiry &&
      integration.tokenExpiry.getTime() < Date.now() - 5 * 60 * 1000; // 5 minutes buffer

    if (needsRefresh && integration.refreshToken) {
      // Refresh token if possible (implement based on provider)
      // For now, return existing credentials
      this.logger.warn(
        `Token for user ${userId} provider ${provider} may be expired`,
      );
    }

    return {
      accessToken: this.encryptionService.decrypt(integration.accessToken),
      refreshToken: integration.refreshToken
        ? this.encryptionService.decrypt(integration.refreshToken)
        : undefined,
      expiryDate: integration.tokenExpiry?.getTime(),
    };
  }

  /**
   * Update calendar credentials (e.g., after token refresh)
   */
  async updateCredentials(
    userId: string,
    provider: 'google' | 'outlook' | 'apple',
    dto: UpdateCalendarCredentialsDto,
  ) {
    const integration =
      await this.prismaService.tenancy.calendarIntegration.findUnique({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
      });

    if (!integration) {
      throw new NotFoundException(
        `Calendar integration not found for user ${userId} and provider ${provider}`,
      );
    }

    const updateData: any = {
      lastSyncedAt: new Date(),
    };

    if (dto.accessToken) {
      updateData.accessToken = this.encryptionService.encrypt(dto.accessToken);
    }

    if (dto.refreshToken !== undefined) {
      updateData.refreshToken = dto.refreshToken
        ? this.encryptionService.encrypt(dto.refreshToken)
        : null;
    }

    if (dto.tokenExpiry) {
      updateData.tokenExpiry = dto.tokenExpiry;
    }

    if (dto.isConnected !== undefined) {
      updateData.isConnected = dto.isConnected;
    }

    if (dto.metadata) {
      updateData.metadata = dto.metadata;
    }

    const updated = await this.prismaService.tenancy.calendarIntegration.update(
      {
        where: { id: integration.id },
        data: updateData,
      },
    );

    this.logger.log(
      `Calendar credentials updated for user ${userId}, provider: ${provider}`,
    );

    return {
      id: updated.id,
      provider: updated.provider,
      isConnected: updated.isConnected,
      lastSyncedAt: updated.lastSyncedAt,
    };
  }

  /**
   * Disconnect calendar integration
   */
  async disconnectCalendar(
    userId: string,
    provider: 'google' | 'outlook' | 'apple',
  ) {
    const integration =
      await this.prismaService.tenancy.calendarIntegration.findUnique({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
      });

    if (!integration) {
      throw new NotFoundException(
        `Calendar integration not found for user ${userId} and provider ${provider}`,
      );
    }

    const updated = await this.prismaService.tenancy.calendarIntegration.update(
      {
        where: { id: integration.id },
        data: {
          isConnected: false,
          // Optionally clear tokens
          // accessToken: null,
          // refreshToken: null,
        },
      },
    );

    this.logger.log(
      `Calendar disconnected for user ${userId}, provider: ${provider}`,
    );

    return {
      id: updated.id,
      provider: updated.provider,
      isConnected: false,
      disconnectedAt: updated.updatedAt,
    };
  }

  /**
   * Delete calendar integration (permanent removal)
   */
  async deleteIntegration(
    userId: string,
    provider: 'google' | 'outlook' | 'apple',
  ) {
    const integration =
      await this.prismaService.tenancy.calendarIntegration.findUnique({
        where: {
          userId_provider: {
            userId,
            provider,
          },
        },
      });

    if (!integration) {
      throw new NotFoundException(
        `Calendar integration not found for user ${userId} and provider ${provider}`,
      );
    }

    await this.prismaService.tenancy.calendarIntegration.delete({
      where: { id: integration.id },
    });

    this.logger.log(
      `Calendar integration deleted for user ${userId}, provider: ${provider}`,
    );

    return {
      success: true,
      message: 'Calendar integration deleted successfully',
    };
  }
}
