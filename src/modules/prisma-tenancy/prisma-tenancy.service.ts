import { Injectable, Inject } from '@nestjs/common';
import * as prismaTenancyProvider from './prisma-tenancy.provider';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class PrismaTenancyService {
  constructor(
    @Inject(prismaTenancyProvider.TENANCY_CLIENT_TOKEN)
    private readonly tenantService: prismaTenancyProvider.ExtendedTenantClient,
    private readonly prismaService: PrismaService,
  ) {}

  get tenancy() {
    return this.tenantService;
  }

  get corePrismaService() {
    return this.prismaService;
  }

  public switch(byPass?: boolean) {
    return byPass ? this.corePrismaService : this.tenancy;
  }
}
