import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  JWT_RESET_PASSWORD_EXPIRATION,
  JWT_RESET_PASSWORD_SECRET,
} from 'constants/env.constant';
import { RedisService } from './redis.service';

export interface OTP {
  context?: any;
  issuedDate: Date;
  expireDate: Date;
  code: string;
}

export enum TokenPurpose {
  PasswordReset = 'passwordReset',
  UserOnboarding = 'userOnboarding',
}

const TokenSecretsByPurpose = {
  [TokenPurpose.PasswordReset]: {
    secret: JWT_RESET_PASSWORD_SECRET,
    expiration: JWT_RESET_PASSWORD_EXPIRATION,
  },
};

type TokenPayload = {
  token: string;
  purpose: TokenPurpose;
};

@Injectable()
export class TokenService {
  private readonly cache = new RedisService();
  private readonly THIRTY_MINUTES_IN_SECONDS = 30 * 60;

  constructor(private readonly jwtService: JwtService) {}

  async generateToken(
    payload: object | Buffer,
    purpose: TokenPurpose = TokenPurpose.PasswordReset,
    expiration?: any,
  ): Promise<string> {
    const expiresIn = expiration || this.THIRTY_MINUTES_IN_SECONDS;
    const token = await this.jwtService.signAsync(payload, {
      secret: TokenSecretsByPurpose[purpose].secret,
      expiresIn,
    });
    await this.saveOnRedis({ token, purpose, expiresIn });
    return token;
  }

  async verifyToken(payload: TokenPayload): Promise<any> {
    const { token, purpose } = payload;

    const isValid = await this.verifyTokenNotBlacklisted(payload);
    if (!isValid) {
      throw new BadRequestException('Token has expired/invalid');
    }

    return this.jwtService.verify(token, {
      secret: TokenSecretsByPurpose[purpose].secret,
    });
  }

  async delete(payload: TokenPayload) {
    const { token, purpose } = payload;
    const cacheKey = this.generateCacheKey(token, purpose);
    await this.cache.delete(cacheKey);
  }

  private generateCacheKey(token: string, purpose: TokenPurpose) {
    return `token:${token}:${purpose}`;
  }

  private async saveOnRedis(payload: TokenPayload & { expiresIn?: any }) {
    const { token, purpose } = payload;
    const cacheKey = this.generateCacheKey(token, purpose);
    await this.cache.set(
      cacheKey,
      { token },
      payload?.expiresIn || this.THIRTY_MINUTES_IN_SECONDS,
    );
  }

  private async verifyTokenNotBlacklisted(payload: TokenPayload) {
    const { token, purpose } = payload;
    const cacheKey = this.generateCacheKey(token, purpose);
    const result = await this.cache.get(cacheKey);
    return !!result;
  }
}
