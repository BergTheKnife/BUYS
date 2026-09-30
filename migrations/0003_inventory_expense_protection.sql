ALTER TABLE "spese"
  ADD COLUMN IF NOT EXISTS "non_eliminabile" integer DEFAULT 0;
