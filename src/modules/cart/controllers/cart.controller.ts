import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CartService } from '../services/cart.service';
import { AddCartItemDto } from '../dtos/add-cart-item.dto';
import { UpdateCartItemDto } from '../dtos/update-cart-item.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';

@Controller('cart')
@ApiTags('Cart')
@UseGuards(PermissionsGuard)
@AuthUserGuard()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Response({ status: HttpStatus.OK, message: 'Cart fetched successfully' })
  @ApiOperation({ summary: 'Get user cart' })
  getCart(@AuthUser() user: User) {
    return this.cartService.getCart(user.id);
  }

  @Post('items')
  @Response({
    status: HttpStatus.CREATED,
    message: 'Item added to cart successfully',
  })
  @ApiOperation({ summary: 'Add item to cart' })
  addItem(@Body() dto: AddCartItemDto, @AuthUser() user: User) {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:id')
  @Response({
    status: HttpStatus.OK,
    message: 'Cart item updated successfully',
  })
  @ApiOperation({ summary: 'Update cart item quantity' })
  updateItem(
    @Param('id') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @AuthUser() user: User,
  ) {
    return this.cartService.updateItem(user.id, itemId, dto);
  }

  @Delete('items/:id')
  @Response({
    status: HttpStatus.OK,
    message: 'Cart item removed successfully',
  })
  @ApiOperation({ summary: 'Remove item from cart' })
  removeItem(@Param('id') itemId: string, @AuthUser() user: User) {
    return this.cartService.removeItem(user.id, itemId);
  }

  @Delete()
  @Response({ status: HttpStatus.OK, message: 'Cart cleared successfully' })
  @ApiOperation({ summary: 'Clear cart' })
  clearCart(@AuthUser() user: User) {
    return this.cartService.clearCart(user.id);
  }
}
