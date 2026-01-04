import { Product } from 'generated/prisma/client';
import { generateRadomKeys } from './string-util';

export function generateProductUploadPrefix(
  product: Product,
  file: Express.Multer.File,
) {
  const uniqueFilename = `${generateRadomKeys(5)}-${file?.originalname}`;
  return `products/${product?.id}/${uniqueFilename}`;
}
