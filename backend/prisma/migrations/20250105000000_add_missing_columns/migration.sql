-- Add missing columns to Photo table
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "placements" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "photoData" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
ALTER TABLE "Photo" ALTER COLUMN "photoFile" DROP NOT NULL;

-- Add missing column to Beat table
ALTER TABLE "Beat" ADD COLUMN IF NOT EXISTS "wavFile" TEXT;

-- Create TeamMember table if it doesn't exist
CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);
