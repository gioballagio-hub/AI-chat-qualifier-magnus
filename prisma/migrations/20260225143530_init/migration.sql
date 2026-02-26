-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "score" TEXT NOT NULL,
    "completeness" REAL NOT NULL,
    "missingFields" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "nextStep" TEXT NOT NULL,
    "sentToIntegration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "integrationMode" TEXT NOT NULL DEFAULT 'WEBHOOK',
    "webhookUrl" TEXT,
    "webhookSecret" TEXT
);
