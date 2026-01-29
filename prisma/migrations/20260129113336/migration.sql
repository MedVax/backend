/*
  Warnings:

  - The values [PHARMACIST] on the enum `PrescriptionType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PrescriptionType_new" AS ENUM ('DOCTOR', 'PATIENT');
ALTER TABLE "Prescription" ALTER COLUMN "prescriberType" TYPE "PrescriptionType_new" USING ("prescriberType"::text::"PrescriptionType_new");
ALTER TYPE "PrescriptionType" RENAME TO "PrescriptionType_old";
ALTER TYPE "PrescriptionType_new" RENAME TO "PrescriptionType";
DROP TYPE "public"."PrescriptionType_old";
COMMIT;
