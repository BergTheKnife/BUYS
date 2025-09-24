
-- Add cassaCoverage field to inventario table
ALTER TABLE inventario ADD COLUMN cassa_coverage NUMERIC(10,2) DEFAULT 0;

-- Update existing records to have 0 cassa coverage (since we can't determine historical values)
UPDATE inventario SET cassa_coverage = 0 WHERE cassa_coverage IS NULL;
