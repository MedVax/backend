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

export const SUPER_ADMIN_EMAIL = config.getOrThrow('SUPER_ADMIN_EMAIL');
export const SUPER_ADMIN_PASSWORD = config.getOrThrow('SUPER_ADMIN_PASSWORD');

export const LOGTAIL_SOURCE_TOKEN = config.get('LOGTAIL_SOURCE_TOKEN');
export const LOGTAIL_INGESTING_HOST = config.get('LOGTAIL_INGESTING_HOST');
export const FRONTEND_URL = config.getOrThrow('FRONTEND_URL');

export const PAYSTACK_SECRET_KEY = config.getOrThrow('PAYSTACK_SECRET_KEY');

export const ECRYPTION_KEY = config.getOrThrow('ECRYPTION_KEY');

export const DO_SPACES_KEY = config.getOrThrow('DO_SPACES_KEY');
export const DO_SPACES_SECRET = config.getOrThrow('DO_SPACES_SECRET');
export const DO_SPACES_ENDPOINT = config.getOrThrow('DO_SPACES_ENDPOINT');
export const DO_SPACES_BUCKET = config.getOrThrow('DO_SPACES_BUCKET');

export const SESSION_COOKIE_MAX_AGE =
  config.get('SESSION_COOKIE_MAX_AGE') || 60 * 60 * 24 * 30; // Default: 30 days in seconds

export const GOOGLE_CLIENT_ID = config.get('GOOGLE_CLIENT_ID');
export const GOOGLE_CLIENT_SECRET = config.get('GOOGLE_CLIENT_SECRET');
export const GOOGLE_REDIRECT_URI = config.get('GOOGLE_REDIRECT_URI');

export const CORS_ORIGIN = config.getOrThrow('CORS_ORIGIN');

// Cloudflare Realtime Kit Configuration
export const CLOUDFLARE_REALTIME_KIT_API_TOKEN = config.get(
  'CLOUDFLARE_REALTIME_KIT_API_TOKEN',
);
export const CLOUDFLARE_REALTIME_KIT_ACCOUNT_ID = config.get(
  'CLOUDFLARE_REALTIME_KIT_ACCOUNT_ID',
);
export const CLOUDFLARE_REALTIME_KIT_APP_ID = config.get(
  'CLOUDFLARE_REALTIME_KIT_APP_ID',
);
export const CLOUDFLARE_REALTIME_KIT_BASE_URL =
  config.get('CLOUDFLARE_REALTIME_KIT_BASE_URL') ||
  'https://api.cloudflare.com/client/v4/accounts';
export const CLOUDFLARE_REALTIME_KIT_MEETING_URL = config.get(
  'CLOUDFLARE_REALTIME_KIT_MEETING_URL',
);

// Legacy Dyte Configuration (deprecated - kept for backward compatibility)
export const DYTE_API_KEY = config.get('DYTE_API_KEY');
export const DYTE_ORG_ID = config.get('DYTE_ORG_ID');
export const DYTE_BASE_URL =
  config.get('DYTE_BASE_URL') || 'https://api.dyte.io/v2';
export const DYTE_APP_URL = config.get('DYTE_APP_URL') || 'https://app.dyte.io';
export const DYTE_S3_ACCESS_KEY = config.get('DYTE_S3_ACCESS_KEY');
export const DYTE_S3_SECRET_KEY = config.get('DYTE_S3_SECRET_KEY');
export const DYTE_S3_BUCKET = config.get('DYTE_S3_BUCKET');
export const DYTE_S3_REGION = config.get('DYTE_S3_REGION') || 'us-east-1';

// Web Push (VAPID) Configuration
// Generate a key pair with: npx web-push generate-vapid-keys
// Push notifications are silently disabled when the keys are absent.
export const VAPID_PUBLIC_KEY = config.get('VAPID_PUBLIC_KEY');
export const VAPID_PRIVATE_KEY = config.get('VAPID_PRIVATE_KEY');
export const VAPID_SUBJECT =
  config.get('VAPID_SUBJECT') || 'mailto:support@medvaxhealth.com';

// Base URL of the admin dashboard, used to deep-link push notifications.
export const ADMIN_URL = config.get('ADMIN_URL') || 'http://localhost:5173';
