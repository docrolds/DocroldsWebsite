-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "rescheduleToken" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "confirmationToken" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_rescheduleToken_key" ON "Booking"("rescheduleToken");

-- CreateIndex
CREATE UNIQUE INDEX "Order_confirmationToken_key" ON "Order"("confirmationToken");
