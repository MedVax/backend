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
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { BlogService } from '../services/blog.service';
import { CreateBlogPostDto } from '../dtos/create-blog-post.dto';
import { UpdateBlogPostDto } from '../dtos/update-blog-post.dto';
import { GetBlogPostsFilterQuery } from '../dtos/get-blog-posts-filter-query.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { UserType } from 'generated/prisma/enums';
import { AuthAllow } from 'metadatas/auth-allow.metadata';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

@Controller('blog')
@ApiTags('Blog')
@UseGuards(PermissionsGuard)
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Featured image (image, max 5MB)',
        },
        title: { type: 'string', example: 'Blog Post Title' },
        content: { type: 'string', example: 'Markdown content here...' },
        excerpt: { type: 'string', example: 'Short description' },
        published: { type: 'boolean', example: false },
        metaTitle: { type: 'string', example: 'SEO Title' },
        metaDescription: { type: 'string', example: 'SEO Description' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['health', 'medicine'],
        },
      },
      required: ['title', 'content'],
    },
  })
  @Response({
    status: HttpStatus.CREATED,
    message: 'Blog post created successfully',
  })
  @ApiOperation({ summary: 'Create a new blog post' })
  async create(
    @Body() dto: CreateBlogPostDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp)/ }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
    @AuthUser() user?: User,
  ) {
    return this.blogService.create(dto, user.id, file);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Blog posts fetched successfully',
  })
  @AuthAllow()
  @ApiOperation({ summary: 'Get all blog posts' })
  async findAll(
    @Query() paginationQueryParams: PaginationQuery,
    @Query() filterQuery: GetBlogPostsFilterQuery,
  ) {
    return this.blogService.findAll(paginationQueryParams, filterQuery);
  }

  @Get('top')
  @AuthAllow()
  @Response({
    status: HttpStatus.OK,
    message: 'Top blog posts fetched successfully',
  })
  @ApiOperation({ summary: 'Get top blog posts (for carousel)' })
  async getTopPosts(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.blogService.getTopPosts(limitNum);
  }

  @Get('slug/:slug')
  @AuthAllow()
  @Response({
    status: HttpStatus.OK,
    message: 'Blog post fetched successfully',
  })
  @ApiOperation({ summary: 'Get blog post by slug (for public viewing)' })
  async findBySlug(@Param('slug') slug: string) {
    return this.blogService.findBySlug(slug);
  }

  @Get(':id')
  @Response({
    status: HttpStatus.OK,
    message: 'Blog post fetched successfully',
  })
  @ApiOperation({ summary: 'Get a blog post by ID' })
  async findOne(@Param('id') id: string) {
    return this.blogService.findOne(id);
  }

  @Patch(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @Response({
    status: HttpStatus.OK,
    message: 'Blog post updated successfully',
  })
  @ApiOperation({ summary: 'Update a blog post' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBlogPostDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp)/ }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
    @AuthUser() user?: User,
  ) {
    return this.blogService.update(id, dto, user?.id, file);
  }

  @Delete(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.OK,
    message: 'Blog post deleted successfully',
  })
  @ApiOperation({ summary: 'Delete a blog post' })
  async remove(@Param('id') id: string, @AuthUser() user?: User) {
    return this.blogService.remove(id, user?.id);
  }
}
