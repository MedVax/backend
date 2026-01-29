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
import { PrescriptionsService } from '../services/prescriptions.service';
import { CreatePrescriptionDto } from '../dtos/create-prescription.dto';
import { VerifyPrescriptionDto } from '../dtos/verify-prescription.dto';
import { Response } from 'metadatas/response.metadata';
import { AuthUser } from 'params/auth-user.param';
import type { User } from 'generated/prisma/client';
import { AuthUserGuard } from 'metadatas/auth-user-guard.metadata';
import { PermissionsGuard } from 'src/guards/permission.guard';
import { PaginationQuery } from 'src/dtos/paginated-query.dto';
import { QueryFilter } from 'params/query-filter';
import { QueryOptions } from 'params/query-options';
import { UserType } from 'generated/prisma/enums';
import { AuthAllow } from 'metadatas/auth-allow.metadata';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

@Controller('prescriptions')
@ApiTags('Prescriptions')
@UseGuards(PermissionsGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  @AuthUserGuard()
  @UseInterceptors(
    FileInterceptor('file', {
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
        file: {
          type: 'string',
          format: 'binary',
          description: 'Prescription file (image or PDF, max 5MB)',
        },
        orderId: { type: 'string', example: 'order-uuid' },
        prescriberType: { type: 'string', enum: ['PATIENT', 'DOCTOR'] },
        // Patient fields
        patientName: { type: 'string', example: 'John Doe' },
        patientLocation: { type: 'string', example: 'Lagos' },
        patientEmail: { type: 'string', example: 'john@example.com' },
        patientPhone: { type: 'string', example: '+2348012345678' },
        additionalNote: { type: 'string', example: 'Additional notes' },
        // Doctor fields
        prescriberName: { type: 'string', example: 'Dr. Jane Smith' },
        prescriberEmail: { type: 'string', example: 'jane@hospital.com' },
        prescriberPhone: { type: 'string', example: '+2348012345679' },
        prescriberHospital: { type: 'string', example: 'General Hospital' },
        prescriberLocation: { type: 'string', example: 'Lagos' },
        hospitalName: { type: 'string', example: 'Lagos General Hospital' },
        drugName: { type: 'string', example: 'Paracetamol 500mg' },
        dosage: { type: 'string', example: 'Take 2 tablets twice daily' },
      },
      required: ['file', 'prescriberType'],
    },
  })
  @Response({
    status: HttpStatus.CREATED,
    message: 'Prescription created successfully',
  })
  @AuthAllow()
  @ApiOperation({ summary: 'Create/upload a prescription with file' })
  create(
    @Body() dto: CreatePrescriptionDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp|pdf)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @AuthUser() user?: User,
  ) {
    return this.prescriptionsService.create(dto, file, user?.id);
  }

  @Get()
  @Response({
    status: HttpStatus.OK,
    message: 'Prescriptions fetched successfully',
  })
  @ApiOperation({ summary: 'Get all prescriptions' })
  findAll(
    @QueryFilter() filter: Record<string, any>,
    @QueryOptions() options: Record<string, any>,
    @Query() query: PaginationQuery,
    @AuthUser() user?: User,
  ) {
    // If user is not admin/clinician, only show their prescriptions
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.prescriptionsService.findAll(userId, filter, options);
  }

  @Get('count')
  @Response({
    status: HttpStatus.OK,
    message: 'Prescriptions count fetched successfully',
  })
  @ApiOperation({ summary: 'Get prescriptions count' })
  count(
    @QueryFilter() filter: Record<string, any>,
    @QueryOptions() options: Record<string, any>,
    @AuthUser() user?: User,
  ) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.prescriptionsService.count(userId, filter, options);
  }

  @Get(':id')
  @Response({
    status: HttpStatus.OK,
    message: 'Prescription fetched successfully',
  })
  @ApiOperation({ summary: 'Get a prescription by ID' })
  findOne(@Param('id') id: string, @AuthUser() user?: User) {
    const userId =
      user && user.type !== UserType.ADMIN && user.type !== UserType.SUPER_ADMIN
        ? user.id
        : undefined;

    return this.prescriptionsService.findOne(id, userId);
  }

  @Patch(':id/verify')
  @AuthUserGuard([UserType.ADMIN, UserType.SUPER_ADMIN])
  @Response({
    status: HttpStatus.OK,
    message: 'Prescription verified successfully',
  })
  @ApiOperation({
    summary: 'Verify/Review a prescription (Admin/Clinician only)',
  })
  verify(
    @Param('id') id: string,
    @Body() dto: VerifyPrescriptionDto,
    @AuthUser() user: User,
  ) {
    return this.prescriptionsService.verify(id, dto, user.id);
  }

  @Delete(':id')
  @AuthUserGuard()
  @Response({
    status: HttpStatus.OK,
    message: 'Prescription deleted successfully',
  })
  @ApiOperation({ summary: 'Delete a prescription' })
  remove(@Param('id') id: string, @AuthUser() user: User) {
    return this.prescriptionsService.remove(id, user.id);
  }
}
