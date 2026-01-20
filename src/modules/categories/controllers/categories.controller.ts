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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { CategoriesService } from '../services/categories.service';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { UpdateCategoryDto } from '../dtos/update-category.dto';
import { BulkCreateCategoryDto } from '../dtos/bulk-create-category.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { UserType } from 'generated/prisma/enums';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { ImageValidationPipe } from 'pipes/image-validation.pipe';
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from 'utils/image-upload.util';
import { CreateCategoryBodySchema } from '../doc/create-category-body.schema';
import { UpdateCategoryBodySchema } from '../doc/update-category-body.schema';

@Controller('categories')
@ApiTags('Categories')
@UseGuards(PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: MAX_IMAGE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody(CreateCategoryBodySchema)
  @Response({
    status: HttpStatus.CREATED,
    message: 'Category created successfully',
  })
  @ApiOperation({
    summary:
      'Create a new category or subcategory with optional image (Admin only)',
    description:
      'Create a category with optional image upload. Image max 2MB. Allowed types: JPEG, PNG, WebP, GIF',
  })
  create(
    @Body() dto: CreateCategoryDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp|gif)/ }),
        ],
      }),
      new ImageValidationPipe(),
    )
    file?: Express.Multer.File,
  ) {
    return this.categoriesService.create(dto, file);
  }

  @Post('bulk')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.CREATED,
    message: 'Categories created successfully',
  })
  @ApiOperation({
    summary: 'Bulk create categories (Admin only)',
    description:
      'Create multiple categories at once. Maximum 100 categories per request. Images are not supported in bulk create - use the update endpoint to add images afterward.',
  })
  bulkCreate(@Body() dto: BulkCreateCategoryDto) {
    return this.categoriesService.bulkCreate(dto);
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
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: MAX_IMAGE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody(UpdateCategoryBodySchema)
  @Response({ status: HttpStatus.OK, message: 'Category updated successfully' })
  @ApiOperation({
    summary: 'Update a category with optional image (Admin only)',
    description:
      'Update a category. Can upload an image to replace the existing one. Supports both multipart/form-data and application/json.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp|gif)/ }),
        ],
      }),
      new ImageValidationPipe(),
    )
    file?: Express.Multer.File,
  ) {
    return this.categoriesService.update(id, dto, file);
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
