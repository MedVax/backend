-- CreateEnum
CREATE TYPE "PrescriptionType" AS ENUM ('DOCTOR', 'PHARMACIST');

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "prescriberType" "PrescriptionType",
ALTER COLUMN "userId" DROP NOT NULL;
