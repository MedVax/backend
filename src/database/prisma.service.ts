import { Injectable } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL, IS_PRODUCTION } from 'constants/env.constant';

@Injectable()
export class PrismaService extends PrismaClient {
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
}
