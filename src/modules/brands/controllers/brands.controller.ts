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
import { BrandsService } from '../services/brands.service';
import { CreateBrandDto } from '../dtos/create-brand.dto';
import { UpdateBrandDto } from '../dtos/update-brand.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { UserType } from 'generated/prisma/enums';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { ImageValidationPipe } from 'pipes/image-validation.pipe';
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from 'utils/image-upload.util';
import { AuthAllow } from 'metadatas/auth-allow.metadata';

@Controller('brands')
@ApiTags('Brands')
@UseGuards(PermissionsGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @UseInterceptors(
    FileInterceptor('logo', {
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Pfizer' },
        description: {
          type: 'string',
          example: 'Leading pharmaceutical company',
        },
        website: { type: 'string', example: 'https://www.pfizer.com' },
        isActive: { type: 'boolean', example: true },
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Brand logo image (max 2MB)',
        },
      },
      required: ['name'],
    },
  })
  @Response({
    status: HttpStatus.CREATED,
    message: 'Brand created successfully',
  })
  @ApiOperation({
    summary: 'Create a new brand with optional logo (Admin only)',
    description:
      'Create a brand with optional logo upload. Logo max 2MB. Allowed types: JPEG, PNG, WebP, GIF',
  })
  create(
    @Body() dto: CreateBrandDto,
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
    return this.brandsService.create(dto, file);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Brands fetched successfully',
  })
  @ApiOperation({
    summary: 'Get all brands (active by default)',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive brands in response',
  })
  @AuthAllow()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.brandsService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @Response({ status: HttpStatus.OK, message: 'Brand fetched successfully' })
  @ApiOperation({
    summary: 'Get a brand by ID',
  })
  @AuthAllow()
  findOne(@Param('id') id: string) {
    return this.brandsService.findOne(id);
  }

  @Patch(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @UseInterceptors(
    FileInterceptor('logo', {
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Pfizer' },
        description: {
          type: 'string',
          example: 'Leading pharmaceutical company',
        },
        website: { type: 'string', example: 'https://www.pfizer.com' },
        isActive: { type: 'boolean', example: true },
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Brand logo image (max 2MB)',
        },
      },
    },
  })
  @Response({ status: HttpStatus.OK, message: 'Brand updated successfully' })
  @ApiOperation({
    summary: 'Update a brand with optional logo (Admin only)',
    description:
      'Update a brand. Can upload a logo to replace the existing one. Supports both multipart/form-data and application/json.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
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
    return this.brandsService.update(id, dto, file);
  }

  @Delete(':id')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({ status: HttpStatus.OK, message: 'Brand deleted successfully' })
  @ApiOperation({
    summary:
      'Delete a brand (Admin only). Cannot delete if it has associated products.',
  })
  remove(@Param('id') id: string) {
    return this.brandsService.remove(id);
  }
}
