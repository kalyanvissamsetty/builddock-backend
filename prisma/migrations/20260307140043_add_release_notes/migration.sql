-- AlterTable
ALTER TABLE "Version" ADD COLUMN     "releaseNotes" TEXT,
ADD COLUMN     "releaseNotesUpdatedAt" TIMESTAMP(3);
