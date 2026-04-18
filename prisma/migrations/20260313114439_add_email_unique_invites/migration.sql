/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `UserInvite` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserInvite_email_key" ON "UserInvite"("email");
