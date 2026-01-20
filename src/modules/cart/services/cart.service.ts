import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { AddCartItemDto } from '../dtos/add-cart-item.dto';
import { UpdateCartItemDto } from '../dtos/update-cart-item.dto';

@Injectable()
export class CartService {
  private logger = new Logger(CartService.name);

  constructor(private prismaService: PrismaTenancyService) {}

  /**
   * Get or create cart for authenticated user (userId) or anonymous user (sessionId)
   */
  async getOrCreateCart(userId?: string, sessionId?: string) {
    if (!userId && !sessionId) {
      throw new BadRequestException(
        'Either userId or sessionId must be provided',
      );
    }

    const where = userId ? { userId } : { sessionId };

    let cart = await this.prismaService.tenancy.cart.findUnique({
      where: where as any,
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prismaService.tenancy.cart.create({
        data: {
          ...(userId ? { userId } : {}),
          ...(sessionId ? { sessionId } : {}),
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  /**
   * Get cart for authenticated user (userId) or anonymous user (sessionId)
   */
  async getCart(userId?: string, sessionId?: string) {
    return this.getOrCreateCart(userId, sessionId);
  }

  /**
   * Add item to cart (supports both authenticated and anonymous users)
   */
  async addItem(
    userId: string | undefined,
    sessionId: string | undefined,
    dto: AddCartItemDto,
  ) {
    // Verify product exists and is active
    const product = await this.prismaService.tenancy.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }

    // Get or create cart
    const cart = await this.getOrCreateCart(userId, sessionId);

    // Check if item already exists in cart
    const existingItem = await this.prismaService.tenancy.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: dto.productId,
        },
      },
    });

    if (existingItem) {
      // Update quantity
      const updatedItem = await this.prismaService.tenancy.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + dto.quantity,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });

      return updatedItem;
    }

    return this.prismaService.tenancy.cartItem.create({
      data: {
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.quantity,
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  /**
   * Update cart item (supports both authenticated and anonymous users)
   */
  async updateItem(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
    dto: UpdateCartItemDto,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const item = await this.prismaService.tenancy.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    if (dto.quantity === 0) {
      await this.prismaService.tenancy.cartItem.delete({
        where: { id: itemId },
      });
      return null;
    }

    return this.prismaService.tenancy.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  /**
   * Remove item from cart (supports both authenticated and anonymous users)
   */
  async removeItem(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const item = await this.prismaService.tenancy.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    return this.prismaService.tenancy.cartItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Clear cart (supports both authenticated and anonymous users)
   */
  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    await this.prismaService.tenancy.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.getCart(userId, sessionId);
  }

  /**
   * Merge session cart into user cart (used when user signs up or logs in)
   */
  async mergeSessionCartToUserCart(userId: string, sessionId: string) {
    if (!sessionId) {
      this.logger.debug('No sessionId provided, skipping cart merge');
      return null;
    }

    try {
      // Get session cart
      const sessionCart = await this.prismaService.tenancy.cart.findUnique({
        where: { sessionId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // If no session cart or empty, nothing to merge
      if (
        !sessionCart ||
        !sessionCart.items ||
        sessionCart.items.length === 0
      ) {
        this.logger.debug('No session cart found or empty, skipping merge');
        return null;
      }

      // Get or create user cart
      const userCart = await this.getOrCreateCart(userId, undefined);

      // Merge items from session cart to user cart
      await this.prismaService.tenancy.$transaction(async (tx) => {
        for (const sessionItem of sessionCart.items) {
          // Check if item already exists in user cart
          const existingItem = await tx.cartItem.findUnique({
            where: {
              cartId_productId: {
                cartId: userCart.id,
                productId: sessionItem.productId,
              },
            },
          });

          if (existingItem) {
            // Update quantity (add session cart quantity to existing)
            await tx.cartItem.update({
              where: { id: existingItem.id },
              data: {
                quantity: existingItem.quantity + sessionItem.quantity,
              },
            });
          } else {
            // Create new item in user cart
            await tx.cartItem.create({
              data: {
                cartId: userCart.id,
                productId: sessionItem.productId,
                quantity: sessionItem.quantity,
              },
            });
          }

          // Delete item from session cart
          await tx.cartItem.delete({
            where: { id: sessionItem.id },
          });
        }

        // Delete session cart after all items are merged
        await tx.cart.delete({
          where: { id: sessionCart.id },
        });
      });

      this.logger.log(
        `Successfully merged ${sessionCart.items.length} items from session cart to user cart for user ${userId}`,
      );

      // Return the updated user cart
      return this.getCart(userId, undefined);
    } catch (error) {
      this.logger.error(
        `Error merging session cart to user cart: ${error.message}`,
        error.stack,
      );
      // Don't throw - we don't want to block signup/login if cart merge fails
      return null;
    }
  }
}
