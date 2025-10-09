
-- Create equity_withdrawals table
CREATE TABLE "equity_withdrawals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "activity_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "member_id" uuid,
  "importo" numeric(10, 2) NOT NULL,
  "tipo" text NOT NULL CHECK (tipo IN ('RIMBORSO', 'DIVIDENDO', 'ALTRO')),
  "descrizione" text,
  "data_operazione" date NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "annullato" boolean DEFAULT false NOT NULL,
  CONSTRAINT "equity_withdrawals_activity_fk" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE cascade,
  CONSTRAINT "equity_withdrawals_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade,
  CONSTRAINT "equity_withdrawals_member_fk" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE set null
);

-- Create indexes
CREATE INDEX "equity_withdrawals_activity_date_idx" ON "equity_withdrawals" ("activity_id", "data_operazione");
CREATE INDEX "equity_withdrawals_activity_tipo_idx" ON "equity_withdrawals" ("activity_id", "tipo");
