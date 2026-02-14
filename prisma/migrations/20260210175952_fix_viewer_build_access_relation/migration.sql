-- DropForeignKey
ALTER TABLE "ViewerBuildAccess" DROP CONSTRAINT "ViewerBuildAccess_id_fkey";

-- AddForeignKey
ALTER TABLE "ViewerBuildAccess" ADD CONSTRAINT "ViewerBuildAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
