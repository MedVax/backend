import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL, IS_PRODUCTION } from 'constants/env.constant';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: DATABASE_URL,
      ...(IS_PRODUCTION ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    super({
      adapter,
      omit: {
        user: {
          password: true,
        },
      },
    });
  }

  async onModuleInit() {
    // Only connect eagerly in production for fail-fast behavior
    // In development, use lazy connection (connects on first query)
    if (IS_PRODUCTION) {
      await this.$connect();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
