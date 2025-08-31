
-- Crea tabella inventory_batches per gestione FIFO
CREATE TABLE "inventory_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventario_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"costo" numeric(10,2) NOT NULL,
	"quantita_iniziale" integer NOT NULL,
	"quantita_rimanente" integer NOT NULL,
	"data_acquisto" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_batches_inventario_fk" FOREIGN KEY ("inventario_id") REFERENCES "public"."inventario"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "inventory_batches_activity_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "inventory_batches_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

-- Crea indici per performance
CREATE INDEX "inventory_batches_inventario_idx" ON "inventory_batches" USING btree ("inventario_id");
CREATE INDEX "inventory_batches_date_idx" ON "inventory_batches" USING btree ("data_acquisto");

-- Popola la tabella con i dati esistenti dell'inventario come primo lotto
INSERT INTO inventory_batches (inventario_id, activity_id, user_id, costo, quantita_iniziale, quantita_rimanente, data_acquisto)
SELECT 
    id as inventario_id,
    activity_id,
    user_id,
    costo,
    quantita as quantita_iniziale,
    quantita as quantita_rimanente,
    COALESCE(created_at, now()) as data_acquisto
FROM inventario
WHERE quantita > 0;
