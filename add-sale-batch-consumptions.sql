-- Tracciamento consumo lotti per vendita (ripristino preciso su modifica/eliminazione)
CREATE TABLE IF NOT EXISTS "sale_batch_consumptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sale_id" uuid NOT NULL,
  "inventario_id" uuid NOT NULL,
  "batch_id" uuid NOT NULL,
  "quantita" integer NOT NULL,
  "costo_unitario" numeric(10,2) NOT NULL,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "sale_batch_consumptions_sale_fk"
    FOREIGN KEY ("sale_id") REFERENCES "vendite"("id") ON DELETE cascade,
  CONSTRAINT "sale_batch_consumptions_inventario_fk"
    FOREIGN KEY ("inventario_id") REFERENCES "inventario"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "sale_batch_consumptions_sale_idx"
  ON "sale_batch_consumptions" ("sale_id");
CREATE INDEX IF NOT EXISTS "sale_batch_consumptions_inventario_idx"
  ON "sale_batch_consumptions" ("inventario_id");
CREATE INDEX IF NOT EXISTS "sale_batch_consumptions_batch_idx"
  ON "sale_batch_consumptions" ("batch_id");
