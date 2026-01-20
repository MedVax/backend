-- CreateEnum
CREATE TYPE "OrderRecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRecurringActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nextRunDate" TIMESTAMP(3),
ADD COLUMN     "paymentRetryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recurringDate" TIMESTAMP(3),
ADD COLUMN     "recurringFrequency" "OrderRecurringFrequency";

-- CreateIndex
CREATE INDEX "Order_isRecurring_idx" ON "Order"("isRecurring");

-- CreateIndex
CREATE INDEX "Order_recurringFrequency_idx" ON "Order"("recurringFrequency");

-- CreateIndex
CREATE INDEX "Order_nextRunDate_idx" ON "Order"("nextRunDate");

-- CreateIndex
CREATE INDEX "Order_isRecurringActive_idx" ON "Order"("isRecurringActive");
