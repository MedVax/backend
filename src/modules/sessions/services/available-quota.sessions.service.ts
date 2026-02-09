import { Injectable, Logger } from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { SessionType } from 'generated/prisma/enums';
import { startOfMonth, endOfMonth } from 'date-fns';

export interface QuotaRequest {
  clientUserId: string;
  hmoId?: string;
  hmoNumber?: string;
  sessionType?: SessionType;
}

export interface SubscriptionQuota {
  individual: {
    availableSessionsCount: number;
    active: boolean;
    id: string | null;
    usedSessionsCount: number;
  };
  couple: {
    availableSessionsCount: number;
    active: boolean;
    id: string | null;
    usedSessionsCount: number;
  };
}

export interface AvailableQuotaResult {
  availableSessionsCount: number;
  giftAvailableSessionsCount: number;
  isUnlimited: boolean;
  sessionFrequency?: 'MONTHLY' | 'YEARLY' | 'UNLIMITED';
  sessionQuote?: number;
  discount?: number;
  sponsor?: 'CLIENT' | 'ORG' | 'HMO' | 'ORG_CLIENT';
  subscription: SubscriptionQuota;
  referral?: {
    percentage: number;
  };
}

@Injectable()
export class AvailableQuotaSessionsService {
  private logger = new Logger(AvailableQuotaSessionsService.name);

  constructor(private prismaService: PrismaTenancyService) { }

  /**
   * Get available sessions quota from all sources
   */
  async getAvailableSessionsQuota(
    request: QuotaRequest,
  ): Promise<AvailableQuotaResult> {
    const {
      clientUserId,
      hmoId,
      hmoNumber,
      sessionType = SessionType.INDIVIDUAL,
    } = request;

    // Get quota from all sources in parallel
    const [subscriptionQuota, giftQuota, hmoQuota] = await Promise.all([
      this.getSubscriptionQuota(clientUserId, sessionType),
      this.getSessionGiftQuota(clientUserId),
      hmoId && hmoNumber
        ? this.getHMOAvailableSessionsQuota(clientUserId, hmoId, hmoNumber)
        : Promise.resolve(null),
    ]);

    // Calculate combined quota
    let availableSessionsCount = 0;
    let isUnlimited = false;
    let sponsor: 'CLIENT' | 'ORG' | 'HMO' | 'ORG_CLIENT' = 'CLIENT';

    // HMO quota takes precedence if available
    if (hmoQuota) {
      if (hmoQuota.isUnlimited) {
        isUnlimited = true;
        availableSessionsCount = 999999; // Represent unlimited
      } else {
        availableSessionsCount = hmoQuota.availableSessionsCount;
      }
      sponsor = 'HMO';
    } else {
      // Use subscription quota
      const relevantSubscription =
        sessionType === SessionType.INDIVIDUAL
          ? subscriptionQuota.individual
          : subscriptionQuota.couple;

      if (relevantSubscription.active) {
        availableSessionsCount = relevantSubscription.availableSessionsCount;
        sponsor = 'ORG'; // Assuming subscription-based is org-sponsored
      }
    }

    // Add gift quota (can combine with other quotas)
    const giftAvailableSessionsCount = giftQuota.availableSessionsCount;
    if (!isUnlimited) {
      availableSessionsCount += giftAvailableSessionsCount;
    }

    return {
      availableSessionsCount: isUnlimited ? 999999 : availableSessionsCount,
      giftAvailableSessionsCount,
      isUnlimited,
      sessionFrequency: hmoQuota?.frequency,
      sessionQuote: hmoQuota?.quota,
      discount: hmoQuota?.discount,
      sponsor,
      subscription: subscriptionQuota,
      referral: {
        percentage: 5, // Default referral discount - should come from config
      },
    };
  }

  /**
   * Get subscription quota for a user
   */
  async getSubscriptionQuota(
    userId: string,
    sessionType: SessionType,
  ): Promise<SubscriptionQuota> {
    console.log('sessionType', sessionType);
    // Get active subscriptions
    const subscriptions =
      await this.prismaService.tenancy.subscription.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          product: true,
        },
      });

    // For now, we'll need to check product metadata or create a mapping
    // Assuming products have session quotas in metadata or separate session quota tracking
    // This is a simplified version - in production, you'd need proper session quota tracking

    let individualQuota = {
      availableSessionsCount: 0,
      active: false,
      id: null as string | null,
      usedSessionsCount: 0,
    };

    const coupleQuota = {
      availableSessionsCount: 0,
      active: false,
      id: null as string | null,
      usedSessionsCount: 0,
    };

    // Count used sessions for current month/year based on subscription frequency
    const now = new Date();
    const startOfCurrentPeriod = startOfMonth(now);
    const endOfCurrentPeriod = endOfMonth(now);

    for (const subscription of subscriptions) {
      // Check if subscription is for sessions (based on product type or metadata)
      // This is simplified - in production, you'd have proper session quota products
      const usedSessionsCount = await this.prismaService.tenancy.session.count({
        where: {
          subscriptionId: subscription.id,
          scheduledDate: {
            gte: startOfCurrentPeriod,
            lte: endOfCurrentPeriod,
          },
          status: {
            notIn: ['CANCELED', 'DECLINED'],
          },
          deleted: false,
        },
      });

      // For now, assume all subscriptions provide individual session quota
      // In production, you'd check product type or metadata
      const quota = subscription.quantity * 10; // Example: 10 sessions per subscription unit
      individualQuota = {
        availableSessionsCount: Math.max(0, quota - usedSessionsCount),
        active: true,
        id: subscription.id,
        usedSessionsCount,
      };
    }

    return {
      individual: individualQuota,
      couple: coupleQuota,
    };
  }

  /**
   * Get HMO available sessions quota
   */
  getHMOAvailableSessionsQuota(
    userId: string,
    hmoId: string,
    hmoNumber: string,
  ): {
    availableSessionsCount: number;
    isUnlimited: boolean;
    frequency?: 'MONTHLY' | 'YEARLY' | 'UNLIMITED';
    quota?: number;
    discount?: number;
  } | null {
    // HMO integration would go here
    // For now, return a placeholder structure
    // In production, you'd query HMO service or database for HMO plans

    // Example structure:
    // const hmoPlan = await hmoService.getPlan(hmoId, hmoNumber);
    // return {
    //   availableSessionsCount: hmoPlan.remainingSessions,
    //   isUnlimited: hmoPlan.isUnlimited,
    //   frequency: hmoPlan.frequency,
    //   quota: hmoPlan.totalQuota,
    //   discount: hmoPlan.discount,
    // };

    this.logger.warn(
      `HMO quota check not implemented for HMO ${hmoId}, number ${hmoNumber}`,
    );

    // Return null to indicate no HMO quota available
    return null;
  }

  /**
   * Get gift session quota
   */
  async getSessionGiftQuota(userId: string): Promise<{
    availableSessionsCount: number;
    gifts: Array<{
      id: string;
      sessionsLeft: number;
      totalSessions: number;
    }>;
  }> {
    const gifts = await this.prismaService.tenancy.sessionGift.findMany({
      where: {
        giftTo: userId,
        isRedeemed: false,
        sessionsLeft: {
          gt: 0,
        },
      },
      select: {
        id: true,
        sessionsLeft: true,
        totalSessions: true,
      },
    });

    const availableSessionsCount = gifts.reduce(
      (sum, gift) => sum + gift.sessionsLeft,
      0,
    );

    return {
      availableSessionsCount,
      gifts: gifts.map((g) => ({
        id: g.id,
        sessionsLeft: g.sessionsLeft,
        totalSessions: g.totalSessions,
      })),
    };
  }
}
