-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_passwordResetToken_key" ON "Customer"("passwordResetToken");
