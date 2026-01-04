import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from '../services/products.service';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { GetProductsFilterQuery } from '../dtos/get-products-filter-query.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { QueryFilter } from 'params/query-filter';
import { QueryOptions } from 'params/query-options';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { UserType } from 'generated/prisma/enums';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';

@Controller('products')
@ApiTags('Products')
@UseGuards(PermissionsGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly prismaService: PrismaTenancyService,
  ) {}

  @Post()
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.CREATED,
    message: 'Product created successfully',
  })
  @ApiOperation({ summary: 'Create a new product (Admin only)' })
  create(@Body() dto: CreateProductDto, @AuthUser() user: User) {
    return this.productsService.create(dto, user.id);
  }

  @Get()
  @Response({ status: HttpStatus.OK, message: 'Products fetched successfully' })
  @ApiOperation({ summary: 'Get all products' })
  async findAll(
    @QueryFilter() filter: Record<string, any>,
    @QueryOptions() options: Record<string, any>,
    @Query() query: PaginationQuery & GetProductsFilterQuery,
  ) {
    // Build filter from query params
    const whereFilter: any = {};

    if (query.search) {
      whereFilter.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.categoryId) {
      // Check if category has subcategories and include them
      const category = await this.prismaService.tenancy.category.findUnique({
        where: { id: query.categoryId },
        include: {
          children: {
            select: { id: true },
          },
        },
      });

      if (category && category.children.length > 0) {
        // Include products from parent category and all subcategories
        const categoryIds = [
          query.categoryId,
          ...category.children.map((c) => c.id),
        ];
        whereFilter.categoryId = { in: categoryIds };
      } else {
        whereFilter.categoryId = query.categoryId;
      }
    }

    if (query.productType) {
      whereFilter.productType = query.productType;
    }

    if (query.requiresPrescription !== undefined) {
      whereFilter.requiresPrescription = query.requiresPrescription === true;
    }

    if (query.isActive !== undefined) {
      whereFilter.isActive = query.isActive === true;
    } else {
      // Default to active products for non-admin users
      whereFilter.isActive = true;
    }

    return this.productsService.findAll({ ...filter, ...whereFilter }, options);
  }

  @Get('count')
  @Response({
    status: HttpStatus.OK,
    message: 'Products count fetched successfully',
  })
  @ApiOperation({ summary: 'Get products count' })
  count(
    @QueryFilter() filter: Record<string, any>,
    @QueryOptions() options: Record<string, any>,
  ) {
    return this.productsService.count(filter, options);
  }

  @Get('search')
  @Response({ status: HttpStatus.OK, message: 'Products search completed' })
  @ApiOperation({ summary: 'Search products' })
  search(
    @Query('q') searchTerm: string,
    @Query() filters: GetProductsFilterQuery,
  ) {
    return this.productsService.searchProducts(searchTerm, filters);
  }

  @Get(':id')
  @Response({ status: HttpStatus.OK, message: 'Product fetched successfully' })
  @ApiOperation({ summary: 'Get a product by ID' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get('sku/:sku')
  @Response({ status: HttpStatus.OK, message: 'Product fetched successfully' })
  @ApiOperation({ summary: 'Get a product by SKU' })
  findBySku(@Param('sku') sku: string) {
    return this.productsService.findBySku(sku);
  }

  @Patch(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Product updated successfully' })
  @ApiOperation({ summary: 'Update a product (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Product deleted successfully' })
  @ApiOperation({ summary: 'Delete a product (Admin only)' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Patch(':id/stock/:pharmacyId')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Stock updated successfully' })
  @ApiOperation({ summary: 'Update product stock for a pharmacy' })
  updateStock(
    @Param('id') productId: string,
    @Param('pharmacyId') pharmacyId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.productsService.updateStock(productId, pharmacyId, quantity);
  }
}
