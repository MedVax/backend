import { Logger } from '@nestjs/common';
import redisClient from 'src/configs/redis.config';

const ONE_YEAR_IN_SECONDS = 31_536_000;

export class RedisService {
  private logger = new Logger(this.constructor.name);

  async get<T = any>(key: string) {
    try {
      const value = await redisClient.get(key);
      const parsedValue = value !== null ? JSON.parse(value) : null;
      return parsedValue as T;
    } catch (error) {
      if (error.name === 'MaxRetriesPerRequestError') {
        console.error(`Critical Redis error: ${error.message}. Shutting down.`);
        process.exit(1);
      } else {
        console.error(`Redis encountered an error: ${error.message}.`);
      }
      this.logger.error(`Redis get key >>> ${error}`);
    }
  }

  async set(
    key: string,
    data: string | Record<string, any>,
    expiresIn = ONE_YEAR_IN_SECONDS,
  ) {
    const value = typeof data === 'string' ? data : JSON.stringify(data);
    await redisClient.set(key, value, 'EX', expiresIn);
    return true;
  }

  async delete(key: string) {
    await redisClient.del(key);
  }
}
