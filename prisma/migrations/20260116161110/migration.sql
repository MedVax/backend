-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "calendarEventId" TEXT,
ADD COLUMN     "calendarIntegrationId" TEXT;

-- CreateTable
CREATE TABLE "CalendarIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "providerEmail" TEXT,
    "calendarId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarIntegration_userId_idx" ON "CalendarIntegration"("userId");

-- CreateIndex
CREATE INDEX "CalendarIntegration_provider_idx" ON "CalendarIntegration"("provider");

-- CreateIndex
CREATE INDEX "CalendarIntegration_isConnected_idx" ON "CalendarIntegration"("isConnected");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarIntegration_userId_provider_key" ON "CalendarIntegration"("userId", "provider");

-- CreateIndex
CREATE INDEX "Session_calendarEventId_idx" ON "Session"("calendarEventId");

-- CreateIndex
CREATE INDEX "Session_calendarIntegrationId_idx" ON "Session"("calendarIntegrationId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_calendarIntegrationId_fkey" FOREIGN KEY ("calendarIntegrationId") REFERENCES "CalendarIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
