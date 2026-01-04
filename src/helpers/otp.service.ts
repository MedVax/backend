import * as otpGenerator from 'otp-generator';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface OTP {
  context?: any;
  issuedDate: Date;
  expireDate: Date;
  code: string;
}

export enum OtpPurpose {
  EmailVerification = 'emailVerification',
  PasswordReset = 'passwordReset',
}

type OtpPayload = {
  otp: string;
  email: string;
  purpose: OtpPurpose;
};

@Injectable()
export class OtpService {
  private readonly cache = new RedisService();

  private readonly THIRTY_MINUTES_IN_SECONDS = 30 * 60;
  private readonly OTP_LENGTH = 4;

  private logger = new Logger();

  private generateKey(email: string, purpose: OtpPurpose) {
    return `${email}::${purpose}::OTP`;
  }

  private generateOTP(length = this.OTP_LENGTH): string {
    const otp: string = otpGenerator.generate(this.OTP_LENGTH, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    if (String(otp).length !== length) {
      return this.generateOTP(length);
    }

    return String(otp);
  }

  async getExistingOTP(email: string, purpose: OtpPurpose) {
    const key = this.generateKey(email, purpose);
    const value = await this.cache.get<Partial<OtpPayload>>(key);
    return value || null;
  }

  async validateOTP(payload: OtpPayload) {
    const { otp, email, purpose } = payload;
    const key = this.generateKey(email, purpose);
    const value = await this.cache.get<Partial<OtpPayload>>(key);
    return value?.otp === otp;
  }

  async deleteOtp(payload: OtpPayload) {
    const { email, purpose } = payload;
    const key = this.generateKey(email, purpose);
    await this.cache.delete(key);
  }

  async generateOTPForUser(
    email: string,
    purpose: OtpPurpose,
  ): Promise<OtpPayload> {
    const otp = this.generateOTP(4);
    const key = this.generateKey(email, purpose);
    await this.cache.set(key, { otp }, this.THIRTY_MINUTES_IN_SECONDS);
    const payload = { email, purpose, otp };
    this.logger.log(payload);
    return payload;
  }
}
