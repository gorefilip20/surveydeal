-- CreateTable
CREATE TABLE "PaymentWallet" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentWallet_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "PaymentWallet_network_address_key" ON "PaymentWallet"("network", "address");
CREATE INDEX "PaymentWallet_isActive_idx" ON "PaymentWallet"("isActive");
CREATE INDEX "PaymentWallet_network_symbol_idx" ON "PaymentWallet"("network", "symbol");

-- Backfill the previous ProtocolConfig JSON representation when it exists.
-- Invalid or non-array legacy values are ignored so deployment remains safe.
DO $$
DECLARE
  legacy_value TEXT;
BEGIN
  SELECT "value" INTO legacy_value
  FROM "ProtocolConfig"
  WHERE "key" = 'payment_wallets'
  LIMIT 1;

  IF legacy_value IS NOT NULL THEN
    BEGIN
      INSERT INTO "PaymentWallet" ("id", "symbol", "network", "address", "label", "instructions", "isActive", "createdAt", "updatedAt")
      SELECT
        md5(random()::text || clock_timestamp()::text || item::text),
        upper(trim(item->>'symbol')),
        upper(trim(item->>'network')),
        trim(item->>'address'),
        NULLIF(trim(item->>'label'), ''),
        NULLIF(trim(item->>'instructions'), ''),
        COALESCE((item->>'isActive')::boolean, true),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM jsonb_array_elements(legacy_value::jsonb) AS item
      WHERE COALESCE(trim(item->>'symbol'), '') <> ''
        AND COALESCE(trim(item->>'network'), '') <> ''
        AND COALESCE(trim(item->>'address'), '') <> ''
      ON CONFLICT ("network", "address") DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping invalid legacy payment_wallets ProtocolConfig value';
    END;
  END IF;
END $$;
