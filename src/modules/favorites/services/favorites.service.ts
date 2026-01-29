import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { AddFavoriteDto } from '../dtos/add-favorite.dto';
import type { Favorite, Prisma } from 'generated/prisma/client';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';

@Injectable()
export class FavoritesService {
  private logger = new Logger(FavoritesService.name);

  constructor(private readonly prismaService: PrismaTenancyService) {}

  /**
   * Add a product to user's favorites
   */
  async addFavorite(userId: string, dto: AddFavoriteDto): Promise<Favorite> {
    // Check if product exists
    const product = await this.prismaService.tenancy.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if already favorited
    const existingFavorite =
      await this.prismaService.tenancy.favorite.findUnique({
        where: {
          userId_productId: {
            userId,
            productId: dto.productId,
          },
        },
      });

    if (existingFavorite) {
      throw new ConflictException('Product is already in favorites');
    }

    // Create favorite
    const favorite = await this.prismaService.tenancy.favorite.create({
      data: {
        userId,
        productId: dto.productId,
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
      },
    });

    this.logger.log(
      `Product ${dto.productId} added to favorites for user ${userId}`,
    );
    return favorite;
  }

  /**
   * Remove a product from user's favorites
   */
  async removeFavorite(userId: string, productId: string): Promise<void> {
    const favorite = await this.prismaService.tenancy.favorite.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.prismaService.tenancy.favorite.delete({
      where: {
        id: favorite.id,
      },
    });

    this.logger.log(
      `Product ${productId} removed from favorites for user ${userId}`,
    );
  }

  /**
   * Get all favorites for a user with pagination
   */
  async getFavorites(userId: string, paginationQuery: PaginationQuery) {
    const { skip, take } = paginationQuery;

    const where: Prisma.FavoriteWhereInput = {
      userId,
    };

    const [favorites, total] = await Promise.all([
      this.prismaService.tenancy.favorite.findMany({
        where,
        include: {
          product: {
            include: {
              category: true,
              brand: true,
            },
          },
        },
        skip,
        take,
        // orderBy: orderBy ? { [orderBy]: 'desc' } : { createdAt: 'desc' },
      }),
      this.prismaService.tenancy.favorite.count({ where }),
    ]);

    return {
      data: favorites,
      meta: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Check if a product is favorited by user
   */
  async isFavorite(userId: string, productId: string): Promise<boolean> {
    const favorite = await this.prismaService.tenancy.favorite.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    return !!favorite;
  }

  /**
   * Get favorite product IDs for a user (useful for bulk checking)
   */
  async getFavoriteProductIds(userId: string): Promise<string[]> {
    const favorites = await this.prismaService.tenancy.favorite.findMany({
      where: { userId },
      select: { productId: true },
    });

    return favorites.map((f) => f.productId);
  }
}
