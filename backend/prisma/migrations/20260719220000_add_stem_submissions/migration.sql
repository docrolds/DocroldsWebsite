-- CreateTable
CREATE TABLE "StemSubmission" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "songName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "notes" TEXT,
    "files" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StemSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StemSubmission_bookingId_idx" ON "StemSubmission"("bookingId");

-- AddForeignKey
ALTER TABLE "StemSubmission" ADD CONSTRAINT "StemSubmission_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
