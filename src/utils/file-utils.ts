import { Product, Category } from 'generated/prisma/client';
import { generateRadomKeys } from './string-util';

export function generateProductUploadPrefix(
  product: Product,
  file: Express.Multer.File,
) {
  const uniqueFilename = `${generateRadomKeys(5)}-${file?.originalname}`;
  return `products/${product?.id}/${uniqueFilename}`;
}

export function generateCategoryImageFileName(
  category: Category,
  file: Express.Multer.File,
): string {
  const timestamp = Date.now();
  const sanitizedName = file.originalname
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase();
  const uniqueFilename = `${generateRadomKeys(5)}-${sanitizedName}`;
  return `categories/${category.id}/${timestamp}-${uniqueFilename}`;
}
