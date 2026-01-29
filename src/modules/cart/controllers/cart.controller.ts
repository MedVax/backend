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
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CartService } from '../services/cart.service';
import { AddCartItemDto } from '../dtos/add-cart-item.dto';
import { UpdateCartItemDto } from '../dtos/update-cart-item.dto';
import { Response as ResponseMetadata } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthAllow } from 'metadatas/auth-allow.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { SessionCookieService } from 'services/session-cookie.service';

@Controller('cart')
@ApiTags('Cart')
@UseGuards(PermissionsGuard)
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly sessionCookieService: SessionCookieService,
  ) {}

  @Get()
  @AuthAllow()
  @ResponseMetadata({
    status: HttpStatus.OK,
    message: 'Cart fetched successfully',
  })
  @ApiOperation({ summary: 'Get user cart (authenticated or anonymous)' })
  getCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @AuthUser() user?: User,
  ) {
    const userId = user?.id;
    const sessionId = userId
      ? undefined
      : this.sessionCookieService.getOrCreateSessionId(req, res);

    return this.cartService.getCart(userId, sessionId);
  }

  @Post('items')
  @AuthAllow()
  @ResponseMetadata({
    status: HttpStatus.CREATED,
    message: 'Item added to cart successfully',
  })
  @ApiOperation({ summary: 'Add item to cart (authenticated or anonymous)' })
  async addItem(
    @Body() dto: AddCartItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @AuthUser() user?: User,
  ) {
    const userId = user?.id;
    const sessionId = userId
      ? undefined
      : this.sessionCookieService.getOrCreateSessionId(req, res);

    return this.cartService.addItem(userId, sessionId, dto);
  }

  @Patch('items/:id')
  @AuthAllow()
  @ResponseMetadata({
    status: HttpStatus.OK,
    message: 'Cart item updated successfully',
  })
  @ApiOperation({
    summary:
      'Update cart item quantity. Set quantity to 0 to remove the item. (authenticated or anonymous)',
  })
  updateItem(
    @Param('id') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @AuthUser() user?: User,
  ) {
    const userId = user?.id;
    const sessionId = userId
      ? undefined
      : this.sessionCookieService.getOrCreateSessionId(req, res);

    return this.cartService.updateItem(userId, sessionId, itemId, dto);
  }

  @Delete('items/:id')
  @AuthAllow()
  @ResponseMetadata({
    status: HttpStatus.OK,
    message: 'Cart item removed successfully',
  })
  @ApiOperation({
    summary: 'Remove item from cart (authenticated or anonymous)',
  })
  removeItem(
    @Param('id') itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @AuthUser() user?: User,
  ) {
    const userId = user?.id;
    const sessionId = userId
      ? undefined
      : this.sessionCookieService.getOrCreateSessionId(req, res);

    return this.cartService.removeItem(userId, sessionId, itemId);
  }

  @Delete()
  @AuthAllow()
  @ResponseMetadata({
    status: HttpStatus.OK,
    message: 'Cart cleared successfully',
  })
  @ApiOperation({ summary: 'Clear cart (authenticated or anonymous)' })
  async clearCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @AuthUser() user?: User,
  ) {
    const userId = user?.id;
    const sessionId = userId
      ? undefined
      : this.sessionCookieService.getOrCreateSessionId(req, res);

    return this.cartService.clearCart(userId, sessionId);
  }
}
