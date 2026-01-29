import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class CategoriesSeedService {
  constructor(private prismaService: PrismaService) {}

  private logger = new Logger();

  private categories = [
    {
      name: 'Health & Wellness',
      description: 'Category 1 description',
      slug: 'health-wellness',
      image: 'https://via.placeholder.com/150',
      subcategories: [
        {
          name: 'Vitamins & Supplements',
          description: 'Vitamins & Supplements description',
          slug: 'vitamins-supplements',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Herbal Supplements',
          description: 'Herbal Supplements description',
          slug: 'herbal-supplements',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Minerals',
          description: 'Minerals description',
          slug: 'minerals',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Probiotics',
          description: 'Probiotics description',
          slug: 'probiotics',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Digestive Health',
          description: 'Digestive Health description',
          slug: 'digestive-health',
          image: 'https://via.placeholder.com/150',
        },
      ],
    },
    {
      name: 'Mother & Child',
      description: 'Category 2 description',
      slug: 'mother-child',
      image: 'https://via.placeholder.com/150',
      subcategories: [
        {
          name: 'Pregnancy',
          description: 'Pregnancy description',
          slug: 'pregnancy',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Breastfeeding',
          description: 'Breastfeeding description',
          slug: 'breastfeeding',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Baby Care',
          description: 'Baby Care description',
          slug: 'baby-care',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Baby Food',
          description: 'Baby Food description',
          slug: 'baby-food',
          image: 'https://via.placeholder.com/150',
        },
      ],
    },
    {
      name: 'Hair',
      description: 'Category 3 description',
      slug: 'hair',
      image: 'https://via.placeholder.com/150',
      subcategories: [
        {
          name: 'Hair Care',
          description: 'Hair Care description',
          slug: 'hair-care',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Hair Loss',
          description: 'Hair Loss description',
          slug: 'hair-loss',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Hair Growth',
          description: 'Hair Growth description',
          slug: 'hair-growth',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Hair Color',
          description: 'Hair Color description',
          slug: 'hair-color',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Hair Treatment',
          description: 'Hair Treatment description',
          slug: 'hair-treatment',
          image: 'https://via.placeholder.com/150',
        },
      ],
    },
    {
      name: 'Skin',
      description: 'Category 4 description',
      slug: 'skin',
      image: 'https://via.placeholder.com/150',
      subcategories: [
        {
          name: 'Skin Care',
          description: 'Skin Care description',
          slug: 'skin-care',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Acne',
          description: 'Acne description',
          slug: 'acne',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Psoriasis',
          description: 'Psoriasis description',
          slug: 'psoriasis',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Eczema',
          description: 'Eczema description',
          slug: 'eczema',
          image: 'https://via.placeholder.com/150',
        },
      ],
    },
    {
      name: 'Mens',
      description: 'Category 6 description',
      slug: 'mens',
      image: 'https://via.placeholder.com/150',
      subcategories: [
        {
          name: 'Mens Care',
          description: 'Mens Care description',
          slug: 'mens-care',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Mens Grooming',
          description: 'Mens Grooming description',
          slug: 'mens-grooming',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Mens Hair Care',
          description: 'Mens Hair Care description',
          slug: 'mens-hair-care',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Mens Skin Care',
          description: 'Mens Skin Care description',
          slug: 'mens-skin-care',
          image: 'https://via.placeholder.com/150',
        },
        {
          name: 'Mens Bath & Body',
          description: 'Mens Bath & Body description',
          slug: 'mens-bath-body',
          image: 'https://via.placeholder.com/150',
        },
      ],
    },
  ];

  async seedCategories() {
    this.logger.log('Running Categories seeder');

    try {
      await this.prismaService.category.createMany({
        data: this.categories.map(({ subcategories, ...category }) => {
          return {
            ...category,
            subcategories: subcategories.map((subcategory) => {
              return {
                ...subcategory,
                parentId: {
                  connect: {
                    name: category.name,
                    slug: category.slug,
                    description: category.description,
                    image: category.image,
                  },
                },
              };
            }),
          };
        }),
      });
    } catch (error) {
      this.logger.error(`Categories Seeder Error: ${error?.message}`);
    }
  }

  async run() {
    await this.seedCategories();
  }
}

export default CategoriesSeedService;
