-- AlterTable
ALTER TABLE "Beat" ADD COLUMN     "soldExclusively" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "soldExclusivelyAt" TIMESTAMP(3),
ADD COLUMN     "soldExclusivelyTo" TEXT;
