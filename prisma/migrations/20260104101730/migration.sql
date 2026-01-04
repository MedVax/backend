/*
  Warnings:

  - You are about to drop the `ProductStock` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductStock" DROP CONSTRAINT "ProductStock_pharmacyId_fkey";

-- DropForeignKey
ALTER TABLE "ProductStock" DROP CONSTRAINT "ProductStock_productId_fkey";

-- DropTable
DROP TABLE "ProductStock";
