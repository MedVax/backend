import Redis from 'ioredis';
import * as env from 'constants/env.constant';

let count = 0;
const onError = (error: any) => {
  console.error(`redis error - ${count++} - ${error}`);
};

const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.IS_PRODUCTION ? { tls: {} } : {}),
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
