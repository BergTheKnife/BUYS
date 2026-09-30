CREATE TABLE IF NOT EXISTS "inventory_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inventario_id" uuid NOT NULL REFERENCES "inventario"("id") ON DELETE CASCADE,
  "activity_id" uuid NOT NULL REFERENCES "activities"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "costo" numeric(10, 2) NOT NULL,
  "quantita_iniziale" integer NOT NULL,
  "quantita_rimanente" integer NOT NULL,
  "data_acquisto" timestamp DEFAULT now() NOT NULL,
  "spesa_id" uuid,
  "idempotency_key" uuid,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "inventory_batches_spesa_fk"
    FOREIGN KEY ("spesa_id") REFERENCES "spese"("id") ON DELETE SET NULL
);
--> statement-breakpoint

ALTER TABLE "inventory_batches"
  ADD COLUMN IF NOT EXISTS "spesa_id" uuid,
  ADD COLUMN IF NOT EXISTS "idempotency_key" uuid;
--> statement-breakpoint

ALTER TABLE "spese" ADD COLUMN IF NOT EXISTS "item_id" uuid;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_batches_spesa_fk'
  ) THEN
    ALTER TABLE "inventory_batches"
      ADD CONSTRAINT "inventory_batches_spesa_fk"
      FOREIGN KEY ("spesa_id") REFERENCES "spese"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spese_item_id_inventario_id_fk'
  ) THEN
    ALTER TABLE "spese"
      ADD CONSTRAINT "spese_item_id_inventario_id_fk"
      FOREIGN KEY ("item_id") REFERENCES "inventario"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_batches_spesa_unique"
  ON "inventory_batches" ("spesa_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_batches_idempotency_key_unique"
  ON "inventory_batches" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "inventory_batches_inventario_idx"
  ON "inventory_batches" ("inventario_id");
CREATE INDEX IF NOT EXISTS "inventory_batches_date_idx"
  ON "inventory_batches" ("data_acquisto");
