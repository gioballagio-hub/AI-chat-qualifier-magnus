-- Magnus SRL Adaptation Migration
-- Run this script against your PostgreSQL database to apply schema changes

-- Rename type column to clienteType and update values
ALTER TABLE "Lead" RENAME COLUMN "type" TO "clienteType";
UPDATE "Lead" SET "clienteType" = 'INDEFINITO' WHERE "clienteType" NOT IN ('AZIENDA', 'PRIVATO', 'INDEFINITO');

-- Update score values from old to new labels
UPDATE "Lead" SET "score" = 'ALTA'  WHERE "score" = 'CALDO';
UPDATE "Lead" SET "score" = 'MEDIA' WHERE "score" = 'TIEPIDO';
UPDATE "Lead" SET "score" = 'BASSA' WHERE "score" = 'FREDDO';

-- Add new Magnus-specific columns
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "telefono"          TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "ragioneSociale"    TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "partitaIVA"        TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "categoriaProdotto" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "brandProdotto"     TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "codiceProdotto"    TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "vinCode"           TEXT;
