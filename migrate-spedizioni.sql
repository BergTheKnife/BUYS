
-- Migration to create spedizioni table
CREATE TABLE IF NOT EXISTS "spedizioni" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"vendita_id" uuid NOT NULL,
	"nome_articolo" text NOT NULL,
	"taglia" text,
	"quantita" integer DEFAULT 1 NOT NULL,
	"venduto_a" text,
	"spedito_consegnato" integer DEFAULT 0,
	"data_spedizione" timestamp,
	"created_at" timestamp DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "spedizioni_vendita_idx" ON "spedizioni" USING btree ("vendita_id");
CREATE INDEX IF NOT EXISTS "spedizioni_activity_idx" ON "spedizioni" USING btree ("activity_id");

-- Add foreign key constraints
ALTER TABLE "spedizioni" ADD CONSTRAINT "spedizioni_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "spedizioni" ADD CONSTRAINT "spedizioni_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE cascade;
ALTER TABLE "spedizioni" ADD CONSTRAINT "spedizioni_vendita_id_vendite_id_fk" FOREIGN KEY ("vendita_id") REFERENCES "vendite"("id") ON DELETE cascade;

-- Populate existing sales with shipping records
INSERT INTO "spedizioni" (
    "user_id", 
    "activity_id", 
    "vendita_id", 
    "nome_articolo", 
    "taglia", 
    "quantita", 
    "venduto_a", 
    "spedito_consegnato", 
    "created_at"
)
SELECT 
    v."user_id",
    v."activity_id", 
    v."id" as "vendita_id",
    v."nome_articolo",
    v."taglia",
    v."quantita",
    v."venduto_a",
    0 as "spedito_consegnato",
    v."created_at"
FROM "vendite" v
WHERE v."venduto_a" IS NOT NULL
ON CONFLICT DO NOTHING;
