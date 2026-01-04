import {
  PipeTransform,
  Injectable,
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  validateImageFile,
  validateImageFiles,
  MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
  type ImageFile,
} from 'utils/image-upload.util';

@Injectable()
export class ImageValidationPipe implements PipeTransform {
  transform(value: ImageFile | ImageFile[]): ImageFile | ImageFile[] {
    if (Array.isArray(value)) {
      validateImageFiles(value);
    } else {
      validateImageFile(value);
    }
    return value;
  }
}

@Injectable()
export class MaxFileSizePipe implements PipeTransform {
  private readonly maxSize: number;

  constructor(maxSize: number = MAX_IMAGE_SIZE) {
    this.maxSize = maxSize;
  }

  transform(value: ImageFile | ImageFile[]): ImageFile | ImageFile[] {
    const files = Array.isArray(value) ? value : [value];

    files.forEach((file) => {
      if (file.size > this.maxSize) {
        throw new BadRequestException(
          `File ${file.originalname} exceeds maximum size of ${this.maxSize / (1024 * 1024)}MB`,
        );
      }
    });

    return value;
  }
}

@Injectable()
export class FileTypeValidationPipe implements PipeTransform {
  private readonly allowedTypes: string[];

  constructor(allowedTypes: string[] = ALLOWED_IMAGE_TYPES) {
    this.allowedTypes = allowedTypes;
  }

  transform(value: ImageFile | ImageFile[]): ImageFile | ImageFile[] {
    const files = Array.isArray(value) ? value : [value];

    files.forEach((file) => {
      if (!this.allowedTypes.includes(file.mimetype)) {
        throw new UnsupportedMediaTypeException(
          `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedTypes.join(', ')}`,
        );
      }
    });

    return value;
  }
}
