-- Migration to add inventory batches table and migrate existing data
CREATE TABLE IF NOT EXISTS inventario_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id UUID NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  costo DECIMAL(10,2) NOT NULL,
  quantita INTEGER NOT NULL,
  quantita_rimanente INTEGER NOT NULL,
  data_acquisto TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS inventario_batches_inventario_idx ON inventario_batches(inventario_id);
CREATE INDEX IF NOT EXISTS inventario_batches_data_idx ON inventario_batches(data_acquisto);

-- Migrate existing inventory items to batches
INSERT INTO inventario_batches (inventario_id, costo, quantita, quantita_rimanente, data_acquisto)
SELECT 
  id as inventario_id,
  costo,
  quantita,
  quantita,
  created_at as data_acquisto
FROM inventario
ON CONFLICT DO NOTHING;
