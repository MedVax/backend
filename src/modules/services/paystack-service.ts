import {
  BadRequestException,
  HttpException,
  HttpExceptionOptions,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios, { AxiosError, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { currencyjs } from 'utils/number-util';
import * as env from 'constants/env.constant';

@Injectable()
export class PaystackService {
  private logger = new Logger(PaystackService.name);

  verifyWebhookSignature(signature: string, body: any) {
    this.logger.log(`Verifying wehbook signature "${signature}"`);

    const hash = crypto
      .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(body))
      .digest('hex');

    if (hash !== signature) {
      this.logger.error(`Invalid webhook signature "${signature}"`);
      throw new PaystackException(`Invalid signature`);
    }

    this.logger.log(`Wehbook signature "${signature}" verified`);

    return body;
  }

  async getCustomer(emailOrCode: string) {
    try {
      const res = await paystackHttp.get(`/customer/${emailOrCode}`);

      this.checkResponseDataStatus(res);

      return res.data?.data;
    } catch (error) {
      throw this.getException(error);
    }
  }

  async createCustomer(options: CustomerOptions) {
    try {
      const res = await paystackHttp.post('/customer', {
        email: options.email,
        first_name: options.firstName,
        last_name: options.lastName,
        phone: options.phone,
        metadata: options.metadata,
      });

      this.checkResponseDataStatus(res);

      return res.data?.data;
    } catch (error) {
      throw this.getException(error);
    }
  }

  async updateCustomer(emailOrCode: string, options: CustomerOptions) {
    try {
      const res = await paystackHttp.put(`/customer/${emailOrCode}`, {
        email: options.email,
        first_name: options.firstName,
        last_name: options.lastName,
        phone: options.phone,
        metadata: options.metadata,
      });

      this.checkResponseDataStatus(res);

      return res.data?.data;
    } catch (error) {
      throw this.getException(error);
    }
  }

  async initBilling(options: BillingInitOptions) {
    try {
      const amount = currencyjs(options.amount ?? 50).multiply(100).value;
      const metadata = Object.assign({}, options.metadata, {
        cancel_action: options?.cancelUrl,
        ip: options.ip,
        user_agent: options?.userAgent,
      });

      const res = await paystackHttp.post('/transaction/initialize', {
        amount: amount,
        email: options.customer.email,
        currency: options.currencyCode,
        reference: options.reference,
        callback_url: options.returnUrl,
        channels: options?.channels ?? ['card'],
        metadata: metadata,
      });

      this.checkResponseDataStatus(res);

      const initLink = res.data?.data;

      await this.updateCustomer(options.customer.email, options.customer);

      const transaction = await this.getBillingMethod(initLink.reference);

      return [transaction, initLink] as const;
    } catch (error) {
      throw this.getException(error);
    }
  }

  async getBillingMethod(reference: string) {
    return await this.confirmBillingMethodCharge(reference);
    // try {
    //   const res = await paystackHttp.get(`/transaction/${reference}`);

    //   this.checkResponseDataStatus(res);

    //   return res.data?.data;
    // } catch (error) {
    //   throw this.getException(error);
    // }
  }

  async initBillingMethod(options: BillingMethodInitOptions) {
    try {
      let transaction: any;
      let initLink: any;

      const amount = currencyjs(options.amount ?? 50).multiply(100).value;
      const metadata = Object.assign({}, options.metadata, {
        cancel_action: options?.cancelUrl,
        ip: options.ip,
        user_agent: options?.userAgent,
      });

      if (options.transactionReference) {
        transaction = await this.getBillingMethod(options.transactionReference);
      }

      if (options.authorizationCode && !transaction) {
        transaction = await this.chargeBillingMethod({
          reference: options.reference,
          amount: amount,
          authorizationCode: options.authorizationCode,
          customer: options.customer,
          currencyCode: options.currencyCode,
          description: options.description,
          metadata: metadata,
        });
      } else if (!transaction) {
        const res = await paystackHttp.post('/transaction/initialize', {
          amount: amount,
          email: options.customer.email,
          currency: options.currencyCode,
          reference: options.reference,
          callback_url: options.returnUrl,
          channels: options?.channels ?? ['card'],
          metadata: metadata,
        });

        this.checkResponseDataStatus(res);

        initLink = res.data?.data;
      }

      await this.updateCustomer(options.customer.email, options.customer);

      if (initLink) {
        transaction = await this.getBillingMethod(initLink.reference);
      }

      return [transaction, initLink] as const;
    } catch (error) {
      throw this.getException(error);
    }
  }

  async confirmBillingMethod(reference: string) {
    return await this.confirmBillingMethodCharge(reference);
  }

  async chargeBillingMethod(options: BillingMethodChargeOptions) {
    try {
      const res = await paystackHttp.post(`/transaction/charge_authorization`, {
        email: options.customer.email,
        amount: currencyjs(options.amount).multiply(100).value,
        currency: options.currencyCode,
        authorization_code: options.authorizationCode,
        reference: options.reference,
        metadata: Object.assign({}, options.metadata, {
          description: options.description,
        }),
      });

      this.checkResponseDataStatus(res);

      const customer = await this.updateCustomer(
        options.customer.email,
        options.customer,
      );

      return Object.assign({}, res.data?.data, { customer });
    } catch (error) {
      throw this.getException(error);
    }
  }

  async confirmBillingMethodCharge(reference: string) {
    try {
      const res = await paystackHttp.get(`/transaction/verify/${reference}`);
      this.checkResponseDataStatus(res);

      return res.data?.data;
    } catch (error) {
      throw this.getException(error);
    }
  }

  checkResponseDataStatus(response: AxiosResponse) {
    const data = response.data;

    if (!data?.status) {
      throw new PaystackException(data?.message, {
        description: data?.message,
      });
    }
    return response;
  }

  getException(error: Error) {
    this.logger.error(error.message);

    if (error instanceof BadRequestException) throw error;

    if (error instanceof AxiosError) {
      if (error?.response) {
        const data = error.response.data;

        if (error.response.status === 404) {
          return new NotFoundException(data?.message || error.message, {
            cause: error,
            description: data?.message || error.message,
          });
        }

        if (!data?.status) {
          this.logger.error(data.message);
          return new PaystackException(data?.message, {
            cause: error,
            description: data?.message,
          });
        }
      }
    }

    return new InternalServerErrorException(undefined, {
      cause: error,
      description: error?.message,
    });
  }
}

const paystackHttp = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
});

export class PaystackException extends HttpException {
  constructor(message = 'PaystackException', options?: HttpExceptionOptions) {
    super(message, 400, options);
    this.cause = options?.cause as AxiosError<any, any>;
  }
}

export type PaystackChannel =
  | 'card'
  | 'bank'
  | 'ussd'
  | 'qr'
  | 'mobile_money'
  | 'bank_transfer'
  | 'eft';

// All payment channels Paystack supports. Use for one-time payments where any
// channel is acceptable. Recurring payments should stay card-only because only
// card transactions return a reusable authorization code for automatic charges.
export const ALL_PAYSTACK_CHANNELS: PaystackChannel[] = [
  'card',
  'bank',
  'ussd',
  'qr',
  'mobile_money',
  'bank_transfer',
  'eft',
];

export interface CustomerOptions {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  metadata?: any;
}

export interface BillingInitOptions {
  reference?: string;
  customer: CustomerOptions;
  currencyCode?: string;
  amount?: number;
  channels?: PaystackChannel[];
  returnUrl?: string;
  cancelUrl?: string;
  description?: string;
  metadata?: any;
  ip?: string;
  userAgent?: string;
}

export interface BillingMethodInitOptions {
  transactionReference?: string;
  reference?: string;
  authorizationCode?: string;
  customer: CustomerOptions;
  currencyCode?: string;
  amount?: number;
  channels?: PaystackChannel[];
  returnUrl?: string;
  cancelUrl?: string;
  description?: string;
  metadata?: any;
  ip?: string;
  userAgent?: string;
}

export interface BillingMethodChargeOptions {
  customer: CustomerOptions;
  reference?: string;
  authorizationCode: string;
  amount: number;
  currencyCode?: string;
  metadata?: any;
  description?: string;
  ip?: string;
  userAgent?: string;
}

export type WithdrawalMethodType =
  | 'ghipss'
  | 'mobile_money'
  | 'kepss'
  | 'nuban'
  | 'basa'
  | 'authorization';

export interface WithdrawalMethodInitOptions {
  type: WithdrawalMethodType;
  email?: string;
  name?: string;
  accountNumber?: string;
  bankCode?: string;
  description?: string;
  currencyCode?: string;
  authorizationCode?: string;
  metadata?: any;
  ip?: string;
  userAgent?: string;
}

export interface WithdrawalMethodTransferOptions {
  source?: 'balance';
  amount: number;
  currencyCode?: string;
  recipientCode: string;
  description?: string;
  reference?: string;
  metadata?: any;
}

export interface BanksOptions {
  countryCode?: string;
  currencyCode?: string;
  type?: WithdrawalMethodType;
  useCursor?: boolean;
  perPage?: number;
}

export interface ValidateBankAccountOptions {
  accountName: string;
  accountNumber: string;
  accountType: 'personal' | 'business';
  bankCode?: string;
  countryCode: string;
  documentType:
    | 'identityNumber'
    | 'passportNumber'
    | 'businessRegistrationNumber';
  documentNumber: string;
}
