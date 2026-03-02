-- CreateTable
CREATE TABLE "WaMessage" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaMessage_phone_processed_idx" ON "WaMessage"("phone", "processed");

-- CreateIndex
CREATE INDEX "WaMessage_createdAt_idx" ON "WaMessage"("createdAt");
