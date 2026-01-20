-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "dosages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "packageSizes" TEXT[] DEFAULT ARRAY[]::TEXT[];
