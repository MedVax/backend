import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { UserProfileType } from 'generated/prisma/enums';
import type {
  UserProfile,
  UserProfileClient,
  UserProfileConsultant,
} from 'generated/prisma/client';

export type ActiveProfileResult = {
  profile: UserProfile;
  clientProfile: UserProfileClient | null;
  consultantProfile: UserProfileConsultant | null;
} | null;

@Injectable()
export class ActiveProfileService {
  constructor(private prismaService: PrismaTenancyService) {}

  /**
   * Get the active profile for a user based on profile ID or type
   * @param userId The user ID
   * @param profileId Optional profile ID from header
   * @param profileType Optional profile type from header (CLIENT, CONSULTANT)
   * @returns The active profile with client/consultant details
   */
  async getActiveProfile(
    userId: string,
    profileId?: string,
    profileType?: UserProfileType,
  ): Promise<ActiveProfileResult> {
    // If profileId is provided, fetch by ID
    if (profileId) {
      const profile = await this.prismaService.tenancy.userProfile.findFirst({
        where: {
          id: profileId,
          userId,
        },
        include: {
          userProfileClients: {
            where: { deletedAt: null },
            take: 1,
          },
          userProfileConsultants: {
            where: { deletedAt: null },
            take: 1,
          },
        },
      });

      if (!profile) {
        throw new NotFoundException(
          `Profile with id "${profileId}" not found for this user`,
        );
      }

      return {
        profile,
        clientProfile: profile.userProfileClients[0] || null,
        consultantProfile: profile.userProfileConsultants[0] || null,
      };
    }

    // If profileType is provided, fetch by type (get the first active one)
    if (profileType) {
      const profile = await this.prismaService.tenancy.userProfile.findFirst({
        where: {
          userId,
          type: profileType,
        },
        include: {
          userProfileClients: {
            where: { deletedAt: null },
            take: 1,
          },
          userProfileConsultants: {
            where: { deletedAt: null },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!profile) {
        throw new NotFoundException(
          `No ${profileType} profile found for this user`,
        );
      }

      return {
        profile,
        clientProfile: profile.userProfileClients[0] || null,
        consultantProfile: profile.userProfileConsultants[0] || null,
      };
    }

    // If neither is provided, return null (caller should handle this)
    return null;
  }

  /**
   * Get all profiles for a user
   */
  async getUserProfiles(userId: string) {
    return this.prismaService.tenancy.userProfile.findMany({
      where: { userId },
      include: {
        userProfileClients: {
          where: { deletedAt: null },
        },
        userProfileConsultants: {
          where: { deletedAt: null },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Validate that a profile belongs to a user
   */
  async validateProfileAccess(
    userId: string,
    profileId: string,
  ): Promise<UserProfile> {
    const profile = await this.prismaService.tenancy.userProfile.findFirst({
      where: {
        id: profileId,
        userId,
      },
    });

    if (!profile) {
      throw new NotFoundException(
        `Profile with id "${profileId}" not found or does not belong to this user`,
      );
    }

    return profile;
  }
}
