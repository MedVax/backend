import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserProfileType, UserStatus, UserType } from 'generated/prisma/enums';
import { randomUUID } from 'crypto';

import { Prisma, User } from 'generated/prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { UserSigninDto } from '../dtos/user-signin.dto';
import {
  JWT_EXPIRATION,
  JWT_REFRESH_EXPIRATION,
  JWT_REFRESH_SECRET,
} from 'constants/env.constant';
import { convertExpiresInToUnixTime } from 'utils/number-util';
import { JwtService } from '@nestjs/jwt';
import { TokenPayloadDto } from '../dtos/token-payload.dto';
import UserService from 'modules/user/services/user.service';
import { BcryptService } from 'services/bcrypt.service';
import { VerifyOtpDTO } from '../dtos/verify-otp.dto';
import { OtpPurpose, OtpService } from 'services/otp.service';
import { MailService } from 'src/mail/services/mail.service';
import { UserSignupDto } from '../dtos/user-signup';
import { normalizeString } from 'utils/string-util';
import { TokenService } from 'services/token.service';
import { AvatarService } from 'services/avatar.service';
import { populateRole } from 'modules/roles/helpers/roles.helper';
import { RedisService } from 'services/redis.service';
import { CartService } from 'modules/cart/services/cart.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
    private userService: UserService,
    private bcryptService: BcryptService,
    private otpService: OtpService,
    private mailService: MailService,
    private tokenService: TokenService,
    private avatarService: AvatarService,
    private redisService: RedisService,
    @Inject(forwardRef(() => CartService))
    private cartService: CartService,
  ) {}

  private logger = new Logger(this.constructor.name);

  private async generateRefreshToken(userId: string) {
    const refreshTokenPayload = { userId };
    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: JWT_REFRESH_SECRET,
      expiresIn: JWT_REFRESH_EXPIRATION,
    });

    return refreshToken;
  }

  public async createToken(
    finalToken: boolean,
    user: Prisma.UserGetPayload<any>,
    activeProfile?: { id: string; type: string } | null,
  ): Promise<TokenPayloadDto> {
    const accessToken = await this.jwtService.signAsync(
      { user, activeProfile },
      {
        secret: JWT_REFRESH_SECRET,
        expiresIn: finalToken ? JWT_REFRESH_EXPIRATION : '10m',
      },
    );
    const refreshToken = await this.generateRefreshToken(user?.id);

    const tokenPayload = {
      userId: user.id,
      expiresIn: convertExpiresInToUnixTime(JWT_EXPIRATION),
      refreshToken,
      accessToken,
    };

    await this.redisService.set(`access-token:userId:${user.id}`, {
      userId: user.id,
      ...tokenPayload,
    });

    return tokenPayload;
  }

  async refreshAccessToken(token: string) {
    const decodedValue = this.jwtService.decode(token, JWT_REFRESH_SECRET);
    const userId = decodedValue?.userId;

    if (!userId) {
      throw new BadRequestException('Invalid refresh token');
    }

    const user = await this.userService.findOneOrThrow<
      Prisma.UserGetPayload<{
        include: {
          userRoles: {
            select: {
              role: {
                select: {
                  id: true;
                  name: true;
                  permissions: {
                    select: {
                      permission: {
                        select: {
                          value: true;
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
      }>
    >(userId, {
      include: { ...populateRole },
    });

    // TODO: check if the new generated token requires 2fa
    const { accessToken, expiresIn, refreshToken } = await this.createToken(
      true,
      user,
    );

    await this.redisService.set(`access-token:userId:${user.id}`, {
      userId: user.id,
      accessToken,
      expiresIn,
      refreshToken,
    });

    return {
      accessToken,
      expiresIn,
      refreshToken,
    };
  }

  async signin(dto: UserSigninDto, sessionId?: string) {
    const user = await this.prismaService.user.findFirst({
      where: {
        email: dto.email,
      },
      omit: {
        password: false,
      },
    });

    if (
      !(user && this.bcryptService.compareSync(dto.password, user.password))
    ) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (user?.status === UserStatus.DEACTIVATED) {
      throw new ForbiddenException(
        'Account deactivated. Please contact support',
        { description: `User ${user.email} is inactive` },
      );
    }

    const updatedUser = await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: { lastLoginAt: new Date().toISOString() },
      include: {
        ...populateRole,
        userProfiles: {
          select: {
            id: true,
            type: true,
            userProfileClients: {
              select: {
                id: true,
              },
            },
            userProfileConsultants: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    let activeProfile: {
      id: string;
      type: string;
      userProfileClient?: string;
      userProfileConsultant?: string;
    } | null = null;

    if (dto.profileType) {
      const profileWithType = updatedUser.userProfiles.find(
        (profile) => profile.type === dto.profileType,
      );

      if (!profileWithType) {
        throw new BadRequestException(
          `No ${dto.profileType?.toString()} profile found for this user`,
        );
      }
      activeProfile = {
        id: profileWithType.id,
        type: profileWithType.type,
        userProfileClient: profileWithType.userProfileClients[0]?.id,
        userProfileConsultant: profileWithType.userProfileConsultants[0]?.id,
      };
    } else if (
      updatedUser.userProfiles &&
      updatedUser.userProfiles.length > 0
    ) {
      // Use the first profile as default if no profileType specified
      activeProfile = {
        id: updatedUser.userProfiles[0].id,
        type: updatedUser.userProfiles[0].type,
        userProfileClient:
          updatedUser.userProfiles[0].userProfileClients[0]?.id,
        userProfileConsultant:
          updatedUser.userProfiles[0].userProfileConsultants[0]?.id,
      };
    }

    // Merge session cart to user cart if sessionId exists
    if (sessionId) {
      await this.cartService.mergeSessionCartToUserCart(
        updatedUser.id,
        sessionId,
      );
    }

    const userToken = await this.createToken(true, updatedUser, activeProfile);

    return {
      user: updatedUser,
      activeProfile,
      ...userToken,
    };
  }

  async signup(dto: UserSignupDto, sessionId?: string) {
    const { firstName, lastName, password, email } = dto;

    const existingUser = await this.prismaService.user.findFirst({
      where: {
        email: normalizeString(email),
      },
    });

    if (existingUser) {
      throw new ConflictException(`User with email ${email} already exists`);
    }

    const avatar = this.avatarService.create(randomUUID());

    const user = await this.prismaService.user.create({
      data: {
        email: normalizeString(email),
        password: this.bcryptService.hashSync(password),
        firstName: normalizeString(firstName),
        lastName: normalizeString(lastName),
        avatar,
        type: UserType.USER,
        lastLoginAt: new Date(),
        firstTimeLogin: false,
        userProfiles: {
          create: {
            type: UserProfileType.CLIENT,
          },
        },
      },
      include: {
        userProfiles: {
          select: {
            id: true,
            type: true,
            userProfileClients: {
              select: {
                id: true,
              },
            },
            userProfileConsultants: {
              select: {
                id: true,
              },
            },
          },
        },
        ...populateRole,
      },
    });

    const activeProfile = {
      id: user.userProfiles[0].id,
      type: user.userProfiles[0].type,
      userProfileClient: user.userProfiles[0].userProfileClients[0]?.id,
      userProfileConsultant: user.userProfiles[0].userProfileConsultants[0]?.id,
    };

    // Merge session cart to user cart if sessionId exists
    if (sessionId) {
      await this.cartService.mergeSessionCartToUserCart(user.id, sessionId);
    }

    const userToken = await this.createToken(true, user, activeProfile);

    return { user, activeProfile, ...userToken };
  }

  async sendVerificationOTP(user: User) {
    const existingUser = await this.prismaService.user.findUnique({
      where: { email: user.email },
    });

    if (existingUser?.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const { otp } = await this.otpService.generateOTPForUser(
      user.email,
      OtpPurpose.EmailVerification,
    );

    await this.mailService.sendVerificationOTP({
      context: { otp },
      to: user.email,
    });

    return null;
  }

  async verifyEmailWithOTP(dto: VerifyOtpDTO, user: User) {
    const { otp } = dto;

    const isValidOtp = await this.otpService.validateOTP({
      email: user.email,
      otp: String(otp),
      purpose: OtpPurpose.EmailVerification,
    });

    if (!isValidOtp) {
      throw new BadRequestException('Invalid Otp');
    }

    await this.otpService.deleteOtp({
      email: user.email,
      otp: String(otp),
      purpose: OtpPurpose.EmailVerification,
    });

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    return null;
  }

  async logout(user: User) {
    const tokenPayload = await this.redisService.get<TokenPayloadDto>(
      `access-token:userId:${user.id}`,
    );

    if (!tokenPayload) {
      throw new BadRequestException('Invalid token');
    }

    await this.redisService.delete(`access-token:userId:${user.id}`);

    return null;
  }
}
