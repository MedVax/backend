import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { randomUUID } from 'crypto';

export interface CreateGiftSessionDto {
  giftFrom: string; // userId
  giftToEmail: string;
  totalSessions: number;
  message?: string;
}

export interface RedeemGiftSessionDto {
  giftId: string;
  userId: string; // recipient userId
}

@Injectable()
export class GiftSessionsService {
  private logger = new Logger(GiftSessionsService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  /**
   * Create a gift session
   */
  async createGift(dto: CreateGiftSessionDto) {
    // Verify giftFrom user exists
    const giftFromUser = await this.prismaService.tenancy.user.findUnique({
      where: { id: dto.giftFrom },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!giftFromUser) {
      throw new NotFoundException(`User with ID ${dto.giftFrom} not found`);
    }

    // Check if recipient exists (optional - can be new user)
    const giftToUser = await this.prismaService.tenancy.user.findUnique({
      where: { email: dto.giftToEmail },
      select: { id: true },
    });

    const gift = await this.prismaService.tenancy.sessionGift.create({
      data: {
        id: randomUUID(),
        giftFrom: dto.giftFrom,
        giftTo: giftToUser?.id || null,
        giftToEmail: dto.giftToEmail,
        totalSessions: dto.totalSessions,
        sessionsLeft: dto.totalSessions,
        message: dto.message,
        isRedeemed: false,
      },
    });

    this.logger.log(
      `Gift session created: ${gift.id} for ${dto.giftToEmail} by ${dto.giftFrom}`,
    );

    // TODO: Send gift email notification
    // await this.mailService.sendGiftSessionNotification({...});

    return gift;
  }

  /**
   * Redeem a gift session (link to user when they sign up/login)
   */
  async redeemGift(dto: RedeemGiftSessionDto) {
    const gift = await this.prismaService.tenancy.sessionGift.findUnique({
      where: { id: dto.giftId },
    });

    if (!gift) {
      throw new NotFoundException(`Gift with ID ${dto.giftId} not found`);
    }

    if (gift.isRedeemed) {
      throw new BadRequestException('Gift session has already been redeemed');
    }

    if (gift.sessionsLeft <= 0) {
      throw new BadRequestException('Gift session has no sessions left');
    }

    // Verify user email matches gift recipient email
    const user = await this.prismaService.tenancy.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    if (user.email.toLowerCase() !== gift.giftToEmail.toLowerCase()) {
      throw new BadRequestException(
        'User email does not match gift recipient email',
      );
    }

    // Update gift to link to user
    const updatedGift = await this.prismaService.tenancy.sessionGift.update({
      where: { id: dto.giftId },
      data: {
        giftTo: dto.userId,
        isRedeemed: true,
        redeemedAt: new Date(),
      },
    });

    this.logger.log(
      `Gift session ${dto.giftId} redeemed by user ${dto.userId}`,
    );

    return updatedGift;
  }

  /**
   * Apply gift session to a booking (deduct from gift quota)
   */
  async applyGiftSession(giftId: string, sessionId: string): Promise<boolean> {
    const gift = await this.prismaService.tenancy.sessionGift.findUnique({
      where: { id: giftId },
    });

    if (!gift) {
      throw new NotFoundException(`Gift with ID ${giftId} not found`);
    }

    if (gift.sessionsLeft <= 0) {
      throw new BadRequestException('Gift session has no sessions left');
    }

    // Deduct from gift quota
    await this.prismaService.tenancy.sessionGift.update({
      where: { id: giftId },
      data: {
        sessionsLeft: gift.sessionsLeft - 1,
      },
    });

    // Link session to gift
    await this.prismaService.tenancy.session.update({
      where: { id: sessionId },
      data: {
        giftId: giftId,
      },
    });

    this.logger.log(
      `Gift session ${giftId} applied to session ${sessionId}. Sessions left: ${gift.sessionsLeft - 1}`,
    );

    return true;
  }

  /**
   * Get available gift sessions for a user
   */
  async getUserGifts(userId: string) {
    const gifts = await this.prismaService.tenancy.sessionGift.findMany({
      where: {
        giftTo: userId,
        isRedeemed: true,
        sessionsLeft: {
          gt: 0,
        },
      },
      include: {
        sessions: {
          where: {
            deleted: false,
          },
          select: {
            id: true,
            scheduledDate: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return gifts;
  }

  /**
   * Get gift by ID
   */
  async getGift(giftId: string) {
    const gift = await this.prismaService.tenancy.sessionGift.findUnique({
      where: { id: giftId },
      include: {
        sessions: {
          where: {
            deleted: false,
          },
        },
      },
    });

    if (!gift) {
      throw new NotFoundException(`Gift with ID ${giftId} not found`);
    }

    return gift;
  }
}
