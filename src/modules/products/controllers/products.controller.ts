import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

import { ProductsService } from '../services/products.service';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { GetProductsFilterQuery } from '../dtos/get-products-filter-query.dto';
import { Response } from 'metadatas/response.metadata';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { QueryFilter } from 'params/query-filter';
import { QueryOptions } from 'params/query-options';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { UserType } from 'generated/prisma/enums';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { PrismaTenancyService } from 'modules/prisma-tenancy/prisma-tenancy.service';
import { ImageValidationPipe } from 'pipes/image-validation.pipe';
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from 'utils/image-upload.util';
import { CreateProductBodySchema } from '../doc/create-product-body.schema';
import { UpdateProductBodySchema } from '../doc/update-product-body.schema';
import { ReplaceProductBodySchema } from '../doc/replace-product-body.schema';
import { UploadImagesBodySchema } from '../doc/upload-images-body.schema';
import { UploadSingleImageBodySchema } from '../doc/upload-single-image-body.schema';

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
  @UseInterceptors(
    FilesInterceptor('images', 10, {
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
  @ApiBody(CreateProductBodySchema)
  @Response({
    status: HttpStatus.CREATED,
    message: 'Product created successfully',
  })
  @ApiOperation({
    summary: 'Create a new product with optional images (Admin only)',
    description:
      'Create a product with optional image uploads. Images can be uploaded during creation or separately using the upload endpoint.',
  })
  async create(
    @Body() body: CreateProductDto,
    @UploadedFiles(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp|gif)/ }),
        ],
      }),
      new ImageValidationPipe(),
    )
    files?: Express.Multer.File[],
  ) {
    return this.productsService.create(body, files);
  }

  @Patch()
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @UseInterceptors(
    FilesInterceptor('images', 10, {
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
  @ApiBody(UpdateProductBodySchema)
  @Response({ status: HttpStatus.OK, message: 'Product updated successfully' })
  @ApiOperation({
    summary: 'Update a product with optional images (Admin only)',
    description:
      'Update a product. Can upload new images (which will be added to existing images), or update other product fields. Supports both multipart/form-data and application/json.',
  })
  async update(
    @Body() body: UpdateProductDto,
    @UploadedFiles(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp|gif)/ }),
        ],
      }),
      new ImageValidationPipe(),
    )
    files?: Express.Multer.File[],
  ) {
    return this.productsService.update(body, files);
  }

  @Put()
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @UseInterceptors(
    FilesInterceptor('images', 10, {
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
  @ApiBody(ReplaceProductBodySchema)
  @Response({ status: HttpStatus.OK, message: 'Product updated successfully' })
  @ApiOperation({
    summary: 'Replace/Update a product with optional images (Admin only)',
    description:
      'Update a product (PUT semantics). Can upload new images to replace or add to existing ones based on replaceImages flag. Supports both multipart/form-data and application/json.',
  })
  async replace(
    @Body() body: UpdateProductDto,
    @UploadedFiles(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp|gif)/ }),
        ],
      }),
      new ImageValidationPipe(),
    )
    files?: Express.Multer.File[],
  ) {
    return this.productsService.update(body, files);
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
        { brand: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.brand) {
      whereFilter.brand = { contains: query.brand, mode: 'insensitive' };
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

  @Delete(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Product deleted successfully' })
  @ApiOperation({ summary: 'Delete a product (Admin only)' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/images')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @UseInterceptors(
    FilesInterceptor('images', 10, {
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
  @ApiBody(UploadImagesBodySchema)
  @Response({
    status: HttpStatus.OK,
    message: 'Images uploaded successfully',
  })
  @ApiOperation({
    summary: 'Upload product images (Admin only)',
    description:
      'Upload images for a product. Max 2MB per image, max 10 images total. Allowed types: JPEG, PNG, WebP, GIF',
  })
  async uploadImages(
    @Param('id') productId: string,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp|gif)/ }),
        ],
      }),
      new ImageValidationPipe(),
    )
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new Error('No images provided');
    }

    return this.productsService.uploadImages(productId, files);
  }

  @Post(':id/images/single')
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
  @ApiBody(UploadSingleImageBodySchema)
  @Response({
    status: HttpStatus.OK,
    message: 'Image uploaded successfully',
  })
  @ApiOperation({
    summary: 'Upload a single product image (Admin only)',
    description:
      'Upload a single image for a product. Max 2MB. Allowed types: JPEG, PNG, WebP, GIF',
  })
  async uploadSingleImage(
    @Param('id') productId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp|gif)/ }),
        ],
      }),
      new ImageValidationPipe(),
    )
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No image provided');
    }

    return this.productsService.uploadImages(productId, [file]);
  }

  @Delete(':id/images/:imageUrl')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.OK,
    message: 'Image deleted successfully',
  })
  @ApiOperation({
    summary: 'Delete a product image (Admin only)',
  })
  async deleteImage(
    @Param('id') productId: string,
    @Param('imageUrl') imageUrl: string,
  ) {
    // Decode URL-encoded image URL
    const decodedImageUrl = decodeURIComponent(imageUrl);
    return this.productsService.deleteImage(productId, decodedImageUrl);
  }
}
