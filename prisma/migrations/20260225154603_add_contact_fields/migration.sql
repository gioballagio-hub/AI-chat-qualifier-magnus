-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
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
    "nome" TEXT,
    "cognome" TEXT,
    "eta" INTEGER,
    "emailContatto" TEXT,
    "emailInviata" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Lead" ("completeness", "consentGiven", "createdAt", "data", "id", "ipHash", "missingFields", "nextStep", "score", "sentToIntegration", "status", "type", "updatedAt") SELECT "completeness", "consentGiven", "createdAt", "data", "id", "ipHash", "missingFields", "nextStep", "score", "sentToIntegration", "status", "type", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
