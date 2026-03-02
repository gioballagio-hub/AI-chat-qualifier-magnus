-- CreateTable
CREATE TABLE "WaConversation" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "raccolto" JSONB NOT NULL DEFAULT '{}',
    "completato" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaConversation_phone_key" ON "WaConversation"("phone");

-- CreateIndex
CREATE INDEX "WaConversation_phone_idx" ON "WaConversation"("phone");
