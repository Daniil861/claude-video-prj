-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "participants" TEXT[] DEFAULT ARRAY[]::TEXT[];
