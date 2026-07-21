-- CreateIndex
CREATE UNIQUE INDEX "OrderItemTransfer_orderItemId_collaboratorId_key" ON "OrderItemTransfer"("orderItemId", "collaboratorId");
