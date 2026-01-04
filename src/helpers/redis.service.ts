import { Injectable, Logger } from '@nestjs/common';
import redisClient from 'src/configs/redis.config';

const THIRTY_DAYS_IN_SECONDS = 2592000;

@Injectable()
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
    expiresIn: number = THIRTY_DAYS_IN_SECONDS,
  ) {
    const value = typeof data === 'string' ? data : JSON.stringify(data);
    await redisClient.set(key, value, 'EX', expiresIn);
    return true;
  }

  async delete(key: string) {
    await redisClient.del(key);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    try {
      // Use SCAN to find all keys matching the pattern
      const stream = redisClient.scanStream({
        match: pattern,
        count: 100,
      });

      const keys = new Set<string>();

      return new Promise<number>((resolve, reject) => {
        stream.on('data', (resultKeys: string[]) => {
          resultKeys.forEach((key) => keys.add(key));
        });

        stream.on('end', () => {
          (async () => {
            if (keys.size > 0) {
              const keysArray = Array.from(keys);
              // Delete in batches to avoid issues with too many keys
              const batchSize = 100;
              for (let i = 0; i < keysArray.length; i += batchSize) {
                const batch = keysArray.slice(i, i + batchSize);
                await redisClient.del(...batch);
              }
              this.logger.debug(
                `Deleted ${keys.size} keys matching pattern: ${pattern}`,
              );
            }
            resolve(keys.size);
          })().catch((err) => {
            this.logger.error(
              `Error deleting keys by pattern ${pattern} during stream end:`,
              err,
            );
            reject(new Error(err));
          });
        });

        stream.on('error', (error: Error) => {
          this.logger.error(
            `Error deleting keys by pattern ${pattern}:`,
            error,
          );
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error(`Error deleting keys by pattern ${pattern}:`, error);
      // Don't throw - cache invalidation failures shouldn't break the operation
      return 0;
    }
  }
}
