import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CategoriesService } from '../services/categories.service';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { UpdateCategoryDto } from '../dtos/update-category.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { UserType } from 'generated/prisma/enums';
import { PermissionsGuard } from 'src/guards/permission.guard';

@Controller('categories')
@ApiTags('Categories')
@UseGuards(PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.CREATED,
    message: 'Category created successfully',
  })
  @ApiOperation({
    summary: 'Create a new category or subcategory (Admin only)',
  })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Categories fetched successfully',
  })
  @ApiOperation({
    summary: 'Get all categories (top-level by default, or all with hierarchy)',
  })
  @ApiQuery({
    name: 'includeSubcategories',
    required: false,
    type: Boolean,
    description: 'Include subcategories in response',
  })
  @ApiQuery({
    name: 'hierarchy',
    required: false,
    type: Boolean,
    description: 'Get full category hierarchy',
  })
  findAll(
    @Query('includeSubcategories') includeSubcategories?: string,
    @Query('hierarchy') hierarchy?: string,
  ) {
    if (hierarchy === 'true') {
      return this.categoriesService.findAllWithHierarchy();
    }
    return this.categoriesService.findAll(includeSubcategories === 'true');
  }

  @Get('parent/:parentId')
  @Response({
    status: HttpStatus.OK,
    message: 'Subcategories fetched successfully',
  })
  @ApiOperation({ summary: 'Get all subcategories of a parent category' })
  findByParent(@Param('parentId') parentId: string) {
    return this.categoriesService.findByParent(parentId);
  }

  @Get(':id')
  @Response({ status: HttpStatus.OK, message: 'Category fetched successfully' })
  @ApiOperation({
    summary: 'Get a category by ID (includes parent and children)',
  })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Get('slug/:slug')
  @Response({ status: HttpStatus.OK, message: 'Category fetched successfully' })
  @ApiOperation({
    summary: 'Get a category by slug (includes parent and children)',
  })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Patch(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Category updated successfully' })
  @ApiOperation({ summary: 'Update a category (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Category deleted successfully' })
  @ApiOperation({
    summary:
      'Delete a category (Admin only). Cannot delete if it has products or subcategories.',
  })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
