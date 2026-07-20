-- CreateTable
CREATE TABLE "Collaborator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "isBusinessAccount" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeatCollaborator" (
    "id" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "splitPercentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BeatCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemTransfer" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "stripeTransferId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collaborator_email_key" ON "Collaborator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Collaborator_stripeAccountId_key" ON "Collaborator"("stripeAccountId");

-- CreateIndex
CREATE INDEX "BeatCollaborator_beatId_idx" ON "BeatCollaborator"("beatId");

-- CreateIndex
CREATE UNIQUE INDEX "BeatCollaborator_beatId_collaboratorId_key" ON "BeatCollaborator"("beatId", "collaboratorId");

-- CreateIndex
CREATE INDEX "OrderItemTransfer_orderItemId_idx" ON "OrderItemTransfer"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemTransfer_status_idx" ON "OrderItemTransfer"("status");

-- AddForeignKey
ALTER TABLE "BeatCollaborator" ADD CONSTRAINT "BeatCollaborator_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeatCollaborator" ADD CONSTRAINT "BeatCollaborator_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemTransfer" ADD CONSTRAINT "OrderItemTransfer_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemTransfer" ADD CONSTRAINT "OrderItemTransfer_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
