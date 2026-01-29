import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FavoritesService } from '../services/favorites.service';
import { AddFavoriteDto } from '../dtos/add-favorite.dto';
import { Response } from 'metadatas/response.metadata';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { PermissionsGuard } from 'src/guards/permission.guard';

@Controller('favorites')
@ApiTags('Favorites')
@UseGuards(PermissionsGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @Response({
    status: HttpStatus.CREATED,
    message: 'Product added to favorites successfully',
  })
  @ApiOperation({ summary: 'Add a product to favorites' })
  addFavorite(@Body() dto: AddFavoriteDto, @AuthUser() user: User) {
    return this.favoritesService.addFavorite(user.id, dto);
  }

  @Delete(':productId')
  @Response({
    status: HttpStatus.OK,
    message: 'Product removed from favorites successfully',
  })
  @ApiOperation({ summary: 'Remove a product from favorites' })
  removeFavorite(
    @Param('productId') productId: string,
    @AuthUser() user: User,
  ) {
    return this.favoritesService.removeFavorite(user.id, productId);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Favorites fetched successfully',
  })
  @ApiOperation({ summary: 'Get user favorites with pagination' })
  getFavorites(
    @Query() paginationQuery: PaginationQuery,
    @AuthUser() user: User,
  ) {
    return this.favoritesService.getFavorites(user.id, paginationQuery);
  }

  @Get('check/:productId')
  @Response({
    status: HttpStatus.OK,
    message: 'Favorite status checked successfully',
  })
  @ApiOperation({ summary: 'Check if a product is favorited' })
  checkFavorite(@Param('productId') productId: string, @AuthUser() user: User) {
    return this.favoritesService.isFavorite(user.id, productId);
  }

  @Get('product-ids')
  @Response({
    status: HttpStatus.OK,
    message: 'Favorite product IDs fetched successfully',
  })
  @ApiOperation({
    summary: 'Get all favorite product IDs for the user',
    description:
      'Returns an array of product IDs that are favorited. Useful for bulk checking.',
  })
  getFavoriteProductIds(@AuthUser() user: User) {
    return this.favoritesService.getFavoriteProductIds(user.id);
  }
}
