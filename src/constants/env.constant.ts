import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

dotenv.config();

const config = new ConfigService();

export const NODE_ENV = config.get('NODE_ENV');
export const IS_DEVELOPMENT = NODE_ENV === 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_STAGING = NODE_ENV === 'staging';

export const PORT = config.get('PORT') || 3000;

export const DATABASE_URL = config.getOrThrow('DATABASE_URL');

export const REDIS_HOST = config.getOrThrow('REDIS_HOST');
export const REDIS_PORT = config.getOrThrow('REDIS_PORT');
export const REDIS_PASSWORD = config.getOrThrow('REDIS_PASSWORD');
export const REDIS_USERNAME = config.get('REDIS_USERNAME');

export const SMTP_HOST = config.get('SMTP_HOST');
export const SMTP_USER = config.get('SMTP_USER');
export const SMTP_PASSWORD = config.get('SMTP_PASSWORD');
export const EMAIL_FROM = config.get('EMAIL_FROM');

export const JWT_SECRET = config.getOrThrow('JWT_SECRET');
export const JWT_EXPIRATION = config.getOrThrow('JWT_EXPIRATION');

export const JWT_REFRESH_SECRET = config.getOrThrow('JWT_REFRESH_SECRET');
export const JWT_REFRESH_EXPIRATION = config.getOrThrow(
  'JWT_REFRESH_EXPIRATION',
);

export const JWT_RESET_PASSWORD_SECRET = config.get(
  'JWT_RESET_PASSWORD_SECRET',
);
export const JWT_RESET_PASSWORD_EXPIRATION = config.get(
  'JWT_RESET_PASSWORD_EXPIRATION',
);

export const JWT_USER_INVITATION_SECRET = config.get(
  'JWT_USER_INVITATION_SECRET',
);
export const JWT_USER_INVITATION_EXPIRATION = config.get(
  'JWT_USER_INVITATION_EXPIRATION',
);

export const SUPER_ADMIN_EMAIL = config.getOrThrow('SUPER_ADMIN_EMAIL');
export const SUPER_ADMIN_PASSWORD = config.getOrThrow('SUPER_ADMIN_PASSWORD');

export const LOGTAIL_SOURCE_TOKEN = config.get('LOGTAIL_SOURCE_TOKEN');
export const FRONTEND_URL = config.getOrThrow('FRONTEND_URL');

export const TWO_FACTOR_AUTHENTICATION_APP_NAME = config.getOrThrow(
  'TWO_FACTOR_AUTHENTICATION_APP_NAME',
);

export const FINCHECKER_USERNAME = config.getOrThrow('FINCHECKER_USERNAME');
export const FINCHECKER_PASSWORD = config.getOrThrow('FINCHECKER_PASSWORD');
export const FINCHECKER_API_KEY = config.getOrThrow('FINCHECKER_API_KEY');
export const FINCHECKER_TRANSACTION_BASE_URL = config.getOrThrow(
  'FINCHECKER_TRANSACTION_BASE_URL',
);

export const STRIPE_SK = config.get('STRIPE_SK');
export const STRIPE_ENDPOINT_SECRET = config.getOrThrow(
  'STRIPE_ENDPOINT_SECRET',
);
export const PAYSTACK_SECRET_KEY = config.getOrThrow('PAYSTACK_SECRET_KEY');

export const ECRYPTION_KEY = config.getOrThrow('ECRYPTION_KEY');

export const FINCHECKER_ID_LIVENESS_BASE_URL = config.getOrThrow(
  'FINCHECKER_ID_LIVENESS_BASE_URL',
);
export const FINCHECKER_ID_LIVENESS_USERNAME = config.getOrThrow(
  'FINCHECKER_ID_LIVENESS_USERNAME',
);
export const FINCHECKER_ID_LIVENESS_PASSWORD = config.getOrThrow(
  'FINCHECKER_ID_LIVENESS_PASSWORD',
);

export const DO_SPACES_KEY = config.getOrThrow('DO_SPACES_KEY');
export const DO_SPACES_SECRET = config.getOrThrow('DO_SPACES_SECRET');
export const DO_SPACES_ENDPOINT = config.getOrThrow('DO_SPACES_ENDPOINT');
export const DO_SPACES_BUCKET = config.getOrThrow('DO_SPACES_BUCKET');

export const YOU_VERIFY_BASE_URL = config.getOrThrow('YOU_VERIFY_BASE_URL');
export const YOU_VERIFY_API_KEY = config.getOrThrow('YOU_VERIFY_API_KEY');
export const YOU_VERIFY_PUBLIC_MERCHANT_KEY = config.getOrThrow(
  'YOU_VERIFY_PUBLIC_MERCHANT_KEY',
);
export const YOU_VERIFY_WEBHOOK_SIGNING_KEY = config.getOrThrow(
  'YOU_VERIFY_WEBHOOK_SIGNING_KEY',
);

export const FINCHECKER_DASHBOARD_API_KEY = config.getOrThrow(
  'FINCHECKER_DASHBOARD_API_KEY',
);
