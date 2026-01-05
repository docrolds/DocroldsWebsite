CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Content_key_key" ON "Content"("key");