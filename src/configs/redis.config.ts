import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import * as env from 'constants/env.constant';

const logger = new Logger('RedisClient');

let count = 0;
const onError = (error: any) => {
  logger.error(
    `Redis connection error (${count++}): ${error.message}`,
    error.stack,
  );
};

const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.IS_PRODUCTION ? { tls: { servername: env.REDIS_HOST } } : {}),
  username: env.REDIS_USERNAME,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
  reconnectOnError(e) {
    return !e.message.includes('WRONGPASS');
  },

  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
}).on('error', onError);

export default redisClient;
