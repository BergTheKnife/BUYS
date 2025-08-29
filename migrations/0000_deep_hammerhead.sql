-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"cognome" text NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"last_activity_id" uuid,
	"email_verified" timestamp,
	"is_active" integer DEFAULT 1,
	"profile_image_url" text,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vendite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"inventario_id" uuid NOT NULL,
	"nome_articolo" text NOT NULL,
	"taglia" text NOT NULL,
	"prezzo_vendita" numeric(10, 2) NOT NULL,
	"incassato_da" text NOT NULL,
	"data" timestamp NOT NULL,
	"margine" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"quantita" integer DEFAULT 1 NOT NULL,
	"incassato_su" text NOT NULL,
	"activity_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spese" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"voce" text NOT NULL,
	"importo" numeric(10, 2) NOT NULL,
	"categoria" text NOT NULL,
	"data" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"activity_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fund_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"activityId" uuid NOT NULL,
	"fromMember" text NOT NULL,
	"fromAccount" text NOT NULL,
	"toAccount" text DEFAULT 'Cassa Reinvestimento' NOT NULL,
	"importo" numeric NOT NULL,
	"descrizione" text,
	"data" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "activity_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nome_articolo" text NOT NULL,
	"taglia" text NOT NULL,
	"costo" numeric(10, 2) NOT NULL,
	"quantita" integer NOT NULL,
	"immagine_url" text,
	"created_at" timestamp DEFAULT now(),
	"activity_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"proprietario_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "activities_nome_key" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_verification_tokens_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "remember_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "remember_tokens_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "financial_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"activityId" uuid NOT NULL,
	"azione" text NOT NULL,
	"descrizione" text NOT NULL,
	"importo" numeric,
	"dettagli" text,
	"data" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "vendite" ADD CONSTRAINT "vendite_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendite" ADD CONSTRAINT "vendite_inventario_id_inventario_id_fk" FOREIGN KEY ("inventario_id") REFERENCES "public"."inventario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendite" ADD CONSTRAINT "vendite_activity_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spese" ADD CONSTRAINT "spese_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spese" ADD CONSTRAINT "spese_activity_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_activity_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remember_tokens" ADD CONSTRAINT "remember_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_history" ADD CONSTRAINT "financial_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_history" ADD CONSTRAINT "financial_history_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_users_activity_idx" ON "activity_users" USING btree ("activity_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "activity_users_user_idx" ON "activity_users" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "remember_tokens_token_idx" ON "remember_tokens" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "remember_tokens_user_idx" ON "remember_tokens" USING btree ("user_id" uuid_ops);
*/