-- Adds durable linkage between an inventory stock-in batch and the expense it
-- generated, plus supporting metadata used by the retroactive reconciliation
-- tool (scripts/reconcile-inventory-expenses.ts).
--
-- spesa_id       -> the "spese" row generated for this batch (1:1, unique)
-- quota_cassa    -> portion of this stock-in covered by "Cassa Reinvestimento"
-- idempotency_key -> optional caller-supplied key to de-duplicate retried stock-in calls

ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS spesa_id uuid;
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS quota_cassa NUMERIC(10,2) DEFAULT 0;
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS idempotency_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_batches_spesa_fk'
  ) THEN
    ALTER TABLE inventory_batches
      ADD CONSTRAINT inventory_batches_spesa_fk
      FOREIGN KEY (spesa_id) REFERENCES spese(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_batches_spesa_unique'
  ) THEN
    ALTER TABLE inventory_batches
      ADD CONSTRAINT inventory_batches_spesa_unique UNIQUE (spesa_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_batches_idempotency_unique'
  ) THEN
    ALTER TABLE inventory_batches
      ADD CONSTRAINT inventory_batches_idempotency_unique UNIQUE (inventario_id, idempotency_key);
  END IF;
END $$;

-- NOTE: this migration is additive/backward-compatible. Existing rows keep
-- spesa_id = NULL until the reconciliation script (dry-run first!) links them
-- to a matching expense or creates a missing one. See
-- scripts/reconcile-inventory-expenses.ts for the rerunnable, safe repair tool
-- and its documented backup/rollback procedure.
