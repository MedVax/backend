import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus, UserType } from 'generated/prisma/enums';
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
import { SendVerifyOtpDTO } from '../dtos/send-verify-otp.dto';
import { UserSignupDto } from '../dtos/user-signup';
import { normalizeString } from 'utils/string-util';
import { TokenPurpose, TokenService } from 'services/token.service';
import { AvatarService } from 'services/avatar.service';
import { populateRole } from 'modules/roles/helpers/roles.helper';
import { RedisService } from 'services/redis.service';

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
  ): Promise<TokenPayloadDto> {
    const accessToken = await this.jwtService.signAsync(
      { user },
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

  async signin(dto: UserSigninDto) {
    let user = await this.prismaService.user.findFirst({
      where: {
        email: dto.email,
      },
      omit: {
        password: false,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
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

    user = await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: { lastLoginAt: new Date().toISOString() },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    const userToken = await this.createToken(true, user);

    return {
      user,
      ...userToken,
    };
  }

  async adminSignin(dto: UserSigninDto) {
    const user = await this.prismaService.user.findFirst({
      where: {
        email: dto.email,
      },
    });
    if (![UserType.ADMIN, UserType.SUPER_ADMIN].includes(user?.type as any)) {
      this.logger.error(
        `User ${dto.email} tried to login with invalid user type ${user?.type}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.signin(dto);
  }

  async signup(dto: UserSignupDto) {
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
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    const userToken = await this.createToken(true, user);

    return { user, ...userToken };
  }

  async sendVerificationOTP(dto: SendVerifyOtpDTO) {
    const { email } = dto;

    const { otp } = await this.otpService.generateOTPForUser(
      email,
      OtpPurpose.EmailVerification,
    );

    await this.mailService.sendVerificationOTP({
      context: { otp },
      to: email,
    });

    return { email };
  }

  async verifyEmailWithOTP(dto: VerifyOtpDTO) {
    const { email, otp } = dto;
    const user = await this.userService.get(email);

    const isValidOtp = await this.otpService.validateOTP({
      email,
      otp: String(otp),
      purpose: OtpPurpose.EmailVerification,
    });

    if (!isValidOtp) {
      throw new BadRequestException('Invalid Otp');
    }

    await this.otpService.deleteOtp({
      email,
      otp: String(otp),
      purpose: OtpPurpose.EmailVerification,
    });

    if (user) throw new ConflictException('Email already exists, kindly login');

    const token = await this.tokenService.generateToken(
      { email },
      TokenPurpose.UserOnboarding,
    );

    return { token };
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
