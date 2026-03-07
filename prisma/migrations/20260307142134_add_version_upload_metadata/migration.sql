-- AlterTable
ALTER TABLE "Version" ADD COLUMN     "lastUploadedAt" TIMESTAMP(3),
ADD COLUMN     "lastUploadedByUserId" INTEGER;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_lastUploadedByUserId_fkey" FOREIGN KEY ("lastUploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
