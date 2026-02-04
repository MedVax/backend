import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import type { User } from 'generated/prisma/client';
import { UserType } from 'generated/prisma/enums';

import { Response } from 'metadatas/response.metadata';
import UserService from '../services/user.service';
import { AuthUser } from 'params/auth-user.param';
import { UpdateUserProfileDto } from '../dtos/update-user-profile.dto';
import { GetUsersFilterQuery } from '../dtos/get-users-filter-query.dto';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';
import { UserDataDto } from '../dtos/user-data.dto';
import { GetUserDto } from '../dtos/get-user-dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { populateRole } from 'modules/roles/helpers/roles.helper';
import type { AuthUserType } from 'types/user.types';
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from 'utils/image-upload.util';

@Controller('users')
@ApiTags('Users')
@UseGuards(PermissionsGuard) // Apply PermissionsGuard globally to the controller
export class UserController {
  constructor(private userService: UserService) {}

  // @Get('count')
  // @HttpCode(HttpStatus.OK)
  // async count(
  //   @QueryFilter() filter: Record<string, any>,
  //   @QueryOptions() options: Record<string, any>,
  // ) {
  //   const count = await this.userService.countWithUrlQuery(filter, options);

  //   return ResponseOk.builder()
  //     .code('info')
  //     .status(200)
  //     .message('Users count retrived')
  //     .data(count)
  //     .build();
  // }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'users fetched successfully',
  })
  @ApiPaginatedResponse(UserDataDto)
  getUsers(
    @Query() paginationQueryParams: PaginationQuery,
    @Query() filterQuery: GetUsersFilterQuery,
  ) {
    return this.userService.getUsers(paginationQueryParams, filterQuery);
  }

  @Post('')
  @Response({
    status: HttpStatus.OK,
    message: 'User created successfully',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN])
  create(@AuthUser() user: User, @Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Put('')
  @Response({
    status: HttpStatus.OK,
    message: 'User updated successfully',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN])
  updateUser(@Body() dto: UpdateUserDto) {
    return this.userService.update(dto);
  }

  @Put('/profile')
  @Response({
    status: HttpStatus.OK,
    message: 'Profile updated successfully',
  })
  updateProfile(@AuthUser() user: User, @Body() dto: UpdateUserProfileDto) {
    return this.userService.updateProfile(user?.id, dto);
  }

  @Put('/photo')
  @AuthUserGuard()
  @UseInterceptors(
    FileInterceptor('file', {
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
  @Response({
    status: HttpStatus.OK,
    message: 'User photo updated successfully',
  })
  @ApiOperation({ summary: 'Update user profile photo' })
  updatePhoto(
    @AuthUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp|gif)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.userService.updatePhoto(user.id, file);
  }

  @Get('/profile')
  @Response({
    status: HttpStatus.OK,
    message: 'Profile fetched successfully',
  })
  @AuthUserGuard()
  async getUserDetail(@AuthUser() user: AuthUserType) {
    const activeProfile = user?.activeProfile;
    const userData = await this.userService.getUser(user?.id);
    return {
      ...userData,
      activeProfile,
    };
  }

  @Get('/:id')
  @Response({
    status: HttpStatus.OK,
    message: 'user fetched successfully',
  })
  @AuthUserGuard([UserType.SUPER_ADMIN, UserType.ADMIN])
  getUser(@Param() params: GetUserDto) {
    return this.userService.findOneOrThrow(params.id, {
      include: {
        ...populateRole,
      },
    });
  }
}
