-- CreateEnum
CREATE TYPE "MeetingFileStatus" AS ENUM ('uploaded');

-- CreateTable
CREATE TABLE "MeetingFile" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "MeetingFileStatus" NOT NULL DEFAULT 'uploaded',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingFile_storageKey_key" ON "MeetingFile"("storageKey");

-- CreateIndex
CREATE INDEX "MeetingFile_meetingId_uploadedAt_idx" ON "MeetingFile"("meetingId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "MeetingFile" ADD CONSTRAINT "MeetingFile_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
