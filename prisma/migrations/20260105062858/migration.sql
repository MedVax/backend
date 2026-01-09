-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "dosages" TEXT,
ADD COLUMN     "packageSizes" TEXT;

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");
