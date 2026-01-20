-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "howToUse" TEXT,
ADD COLUMN     "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pharmacyAdvise" TEXT,
ADD COLUMN     "specification" TEXT;
