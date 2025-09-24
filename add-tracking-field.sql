
-- Migration to add tracking number field to spedizioni table
ALTER TABLE spedizioni ADD COLUMN numero_tracking TEXT;
