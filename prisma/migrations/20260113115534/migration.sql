-- CreateEnum
CREATE TYPE "UserProfileType" AS ENUM ('CLIENT', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('CUSTOM', 'WEEKLY');

-- CreateEnum
CREATE TYPE "AvailabilityPeriod" AS ENUM ('WEEKDAYS', 'WEEKENDS', 'MIXED');

-- CreateEnum
CREATE TYPE "DateLabel" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('COMPLETED', 'UPCOMING', 'PENDING', 'CANCELED', 'DECLINED', 'PENDING_APPROVAL', 'APPROVED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gender" TEXT;

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserProfileType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfileClient" (
    "id" TEXT NOT NULL,
    "coverName" TEXT,
    "referral" TEXT,
    "channel" TEXT,
    "useCoverName" BOOLEAN DEFAULT false,
    "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasBookedSession" BOOLEAN DEFAULT false,
    "userProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "userProfileConsultantId" TEXT,

    CONSTRAINT "UserProfileClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfileConsultant" (
    "id" TEXT NOT NULL,
    "introVideo" TEXT,
    "bio" TEXT,
    "rate" DOUBLE PRECISION,
    "jobTitle" TEXT,
    "areaOfExpertise" TEXT[],
    "yearsOfExperience" INTEGER,
    "faith" TEXT,
    "availabilityPeriod" "AvailabilityPeriod",
    "offerFaithTherapy" BOOLEAN,
    "hasSetAvailability" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION,
    "userProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserProfileConsultant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultantAvailability" (
    "id" TEXT NOT NULL,
    "type" "AvailabilityType" NOT NULL,
    "consultantId" TEXT NOT NULL,
    "dayOfWeek" "DateLabel",
    "dateString" TEXT,
    "date" TIMESTAMP(3),
    "slots" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledDateString" TEXT NOT NULL,
    "meetingId" TEXT,
    "metadata" JSONB,
    "clientTimezone" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "UserProfileClient_userProfileId_idx" ON "UserProfileClient"("userProfileId");

-- CreateIndex
CREATE INDEX "UserProfileClient_deletedAt_idx" ON "UserProfileClient"("deletedAt");

-- CreateIndex
CREATE INDEX "UserProfileConsultant_userProfileId_idx" ON "UserProfileConsultant"("userProfileId");

-- CreateIndex
CREATE INDEX "UserProfileConsultant_deletedAt_idx" ON "UserProfileConsultant"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultantAvailability_id_key" ON "ConsultantAvailability"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_key" ON "Session"("id");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileClient" ADD CONSTRAINT "UserProfileClient_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileClient" ADD CONSTRAINT "UserProfileClient_userProfileConsultantId_fkey" FOREIGN KEY ("userProfileConsultantId") REFERENCES "UserProfileConsultant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileConsultant" ADD CONSTRAINT "UserProfileConsultant_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantAvailability" ADD CONSTRAINT "ConsultantAvailability_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "UserProfileConsultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "UserProfileClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "UserProfileConsultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
