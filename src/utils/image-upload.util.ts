import {
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

export interface ImageFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * Validate image file
 */
export function validateImageFile(file: ImageFile): void {
  if (!file) {
    throw new BadRequestException('No file provided');
  }

  // Check file size
  if (file.size > MAX_IMAGE_SIZE) {
    throw new BadRequestException(
      `Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`,
    );
  }

  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new UnsupportedMediaTypeException(
      `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
    );
  }
}

/**
 * Validate multiple image files
 */
export function validateImageFiles(files: ImageFile[]): void {
  if (!files || files.length === 0) {
    throw new BadRequestException('No files provided');
  }

  // Limit number of images (optional, can be adjusted)
  const MAX_IMAGES = 10;
  if (files.length > MAX_IMAGES) {
    throw new BadRequestException(
      `Maximum ${MAX_IMAGES} images allowed per product`,
    );
  }

  // Validate each file
  files.forEach((file, index) => {
    try {
      validateImageFile(file);
    } catch (error) {
      throw new BadRequestException(
        `Image ${index + 1} (${file.originalname}): ${error.message}`,
      );
    }
  });
}

/**
 * Generate unique filename for product image
 */
export function generateProductImageFileName(
  productId: string,
  originalName: string,
  index?: number,
): string {
  const timestamp = Date.now();
  // const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase();

  if (index !== undefined) {
    return `products/${productId}/${timestamp}-${index}-${sanitizedName}`;
  }
  return `products/${productId}/${timestamp}-${sanitizedName}`;
}
