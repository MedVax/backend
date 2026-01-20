/*
  Warnings:

  - A unique constraint covering the columns `[scheduledDateString]` on the table `Session` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('INDIVIDUAL', 'COUPLE', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "OrganizationSponsor" AS ENUM ('CLIENT', 'ORG', 'HMO', 'ORG_CLIENT');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "changeLog" JSONB,
ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "giftId" TEXT,
ADD COLUMN     "hmoId" TEXT,
ADD COLUMN     "hmoNumber" TEXT,
ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "paidBy" "OrganizationSponsor" NOT NULL DEFAULT 'CLIENT',
ADD COLUMN     "rescheduled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionType" "SessionType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "subscriptionId" TEXT,
ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");

-- DropIndex
DROP INDEX "Session_id_key";

-- CreateTable
CREATE TABLE "SessionParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joined" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionInvitee" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionInvitee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionActivity" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "meetingStartTime" TIMESTAMP(3),
    "meetingEndTime" TIMESTAMP(3),
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRescheduleRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "requestedDateString" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedBy" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionRescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionReview" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionGift" (
    "id" TEXT NOT NULL,
    "giftFrom" TEXT NOT NULL,
    "giftTo" TEXT,
    "giftToEmail" TEXT NOT NULL,
    "sessionsLeft" INTEGER NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL,
    "message" TEXT,
    "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionGift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionParticipant_sessionId_idx" ON "SessionParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "SessionParticipant_userId_idx" ON "SessionParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_sessionId_email_key" ON "SessionParticipant"("sessionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SessionInvitee_token_key" ON "SessionInvitee"("token");

-- CreateIndex
CREATE INDEX "SessionInvitee_sessionId_idx" ON "SessionInvitee"("sessionId");

-- CreateIndex
CREATE INDEX "SessionInvitee_token_idx" ON "SessionInvitee"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SessionInvitee_sessionId_email_key" ON "SessionInvitee"("sessionId", "email");

-- CreateIndex
CREATE INDEX "SessionActivity_sessionId_idx" ON "SessionActivity"("sessionId");

-- CreateIndex
CREATE INDEX "SessionActivity_createdAt_idx" ON "SessionActivity"("createdAt");

-- CreateIndex
CREATE INDEX "SessionRescheduleRequest_sessionId_idx" ON "SessionRescheduleRequest"("sessionId");

-- CreateIndex
CREATE INDEX "SessionRescheduleRequest_status_idx" ON "SessionRescheduleRequest"("status");

-- CreateIndex
CREATE INDEX "SessionRescheduleRequest_requestedBy_idx" ON "SessionRescheduleRequest"("requestedBy");

-- CreateIndex
CREATE UNIQUE INDEX "SessionReview_sessionId_key" ON "SessionReview"("sessionId");

-- CreateIndex
CREATE INDEX "SessionReview_sessionId_idx" ON "SessionReview"("sessionId");

-- CreateIndex
CREATE INDEX "SessionReview_rating_idx" ON "SessionReview"("rating");

-- CreateIndex
CREATE INDEX "SessionGift_giftFrom_idx" ON "SessionGift"("giftFrom");

-- CreateIndex
CREATE INDEX "SessionGift_giftTo_idx" ON "SessionGift"("giftTo");

-- CreateIndex
CREATE INDEX "SessionGift_giftToEmail_idx" ON "SessionGift"("giftToEmail");

-- CreateIndex
CREATE INDEX "SessionGift_isRedeemed_idx" ON "SessionGift"("isRedeemed");

-- CreateIndex
CREATE UNIQUE INDEX "Session_scheduledDateString_key" ON "Session"("scheduledDateString");

-- CreateIndex
CREATE INDEX "Session_clientId_idx" ON "Session"("clientId");

-- CreateIndex
CREATE INDEX "Session_consultantId_idx" ON "Session"("consultantId");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Session_scheduledDate_idx" ON "Session"("scheduledDate");

-- CreateIndex
CREATE INDEX "Session_scheduledDateString_idx" ON "Session"("scheduledDateString");

-- CreateIndex
CREATE INDEX "Session_sessionType_idx" ON "Session"("sessionType");

-- CreateIndex
CREATE INDEX "Session_subscriptionId_idx" ON "Session"("subscriptionId");

-- CreateIndex
CREATE INDEX "Session_giftId_idx" ON "Session"("giftId");

-- CreateIndex
CREATE INDEX "Session_deleted_idx" ON "Session"("deleted");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "SessionGift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionInvitee" ADD CONSTRAINT "SessionInvitee_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionActivity" ADD CONSTRAINT "SessionActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRescheduleRequest" ADD CONSTRAINT "SessionRescheduleRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionReview" ADD CONSTRAINT "SessionReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
