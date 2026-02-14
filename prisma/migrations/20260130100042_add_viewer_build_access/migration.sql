-- CreateTable
CREATE TABLE "ViewerBuildAccess" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewerBuildAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ViewerBuildAccess_userId_versionId_key" ON "ViewerBuildAccess"("userId", "versionId");

-- AddForeignKey
ALTER TABLE "ViewerBuildAccess" ADD CONSTRAINT "ViewerBuildAccess_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerBuildAccess" ADD CONSTRAINT "ViewerBuildAccess_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
