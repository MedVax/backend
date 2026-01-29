import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';

@Injectable()
export class BrandsSeedService implements OnModuleInit {
  private logger = new Logger(BrandsSeedService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  private brands = [
    {
      name: 'Pfizer',
      description:
        'Leading pharmaceutical company known for innovative medicines and vaccines',
      website: 'https://www.pfizer.com',
      isActive: true,
    },
    {
      name: 'GlaxoSmithKline (GSK)',
      description:
        'Global healthcare company focused on pharmaceuticals and vaccines',
      website: 'https://www.gsk.com',
      isActive: true,
    },
    {
      name: 'Novartis',
      description: 'Swiss multinational pharmaceutical corporation',
      website: 'https://www.novartis.com',
      isActive: true,
    },
    {
      name: 'Roche',
      description:
        'Swiss multinational healthcare company specializing in pharmaceuticals and diagnostics',
      website: 'https://www.roche.com',
      isActive: true,
    },
    {
      name: 'Merck',
      description: 'American multinational pharmaceutical company',
      website: 'https://www.merck.com',
      isActive: true,
    },
    {
      name: 'Johnson & Johnson',
      description: 'American multinational corporation founded in 1886',
      website: 'https://www.jnj.com',
      isActive: true,
    },
    {
      name: 'AstraZeneca',
      description:
        'British-Swedish multinational pharmaceutical and biotechnology company',
      website: 'https://www.astrazeneca.com',
      isActive: true,
    },
    {
      name: 'Sanofi',
      description: 'French multinational pharmaceutical and healthcare company',
      website: 'https://www.sanofi.com',
      isActive: true,
    },
    {
      name: 'Bayer',
      description:
        'German multinational pharmaceutical and biotechnology company',
      website: 'https://www.bayer.com',
      isActive: true,
    },
    {
      name: 'Abbott',
      description:
        'American multinational medical devices and health care company',
      website: 'https://www.abbott.com',
      isActive: true,
    },
    {
      name: 'Teva',
      description: 'Israeli multinational pharmaceutical company',
      website: 'https://www.tevapharm.com',
      isActive: true,
    },
    {
      name: 'Mylan',
      description: 'American generic and specialty pharmaceuticals company',
      website: 'https://www.mylan.com',
      isActive: true,
    },
    {
      name: 'Sun Pharma',
      description: 'Indian multinational pharmaceutical company',
      website: 'https://www.sunpharma.com',
      isActive: true,
    },
    {
      name: 'Cipla',
      description:
        'Indian multinational pharmaceutical and biotechnology company',
      website: 'https://www.cipla.com',
      isActive: true,
    },
    {
      name: 'Lupin',
      description: 'Indian multinational pharmaceutical company',
      website: 'https://www.lupin.com',
      isActive: true,
    },
  ];

  async seedBrands() {
    this.logger.log('Running Brands seeder');

    try {
      for (const brand of this.brands) {
        const existing = await this.prismaService.tenancy.brand.findFirst({
          where: { name: brand.name },
        });

        if (!existing) {
          await this.prismaService.tenancy.brand.create({
            data: brand,
          });
        } else {
          this.logger.debug(`Brand ${brand.name} already exists, skipping`);
        }
      }

      this.logger.log(`Successfully seeded ${this.brands.length} brands`);
    } catch (error) {
      this.logger.error(`Brand Seeder Error: ${error?.message}`, error.stack);
    }
  }

  async onModuleInit() {
    // Only run seeder in development or if explicitly enabled
    if (
      process.env.NODE_ENV !== 'production' ||
      process.env.RUN_SEEDERS === 'true'
    ) {
      await this.seedBrands();
    }
  }

  async run() {
    await this.seedBrands();
  }
}
