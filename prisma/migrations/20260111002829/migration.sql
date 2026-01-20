/*
  Warnings:

  - You are about to drop the column `brand` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `dosages` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `packageSizes` on the `Product` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Product_brand_idx";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "brand",
DROP COLUMN "dosages",
DROP COLUMN "packageSizes";
