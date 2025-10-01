
-- === Store Config ===
CREATE TABLE IF NOT EXISTS store_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  tipologia_store text NOT NULL,
  valuta text NOT NULL DEFAULT 'EUR',
  paese text NOT NULL DEFAULT 'IT',
  iva_predefinita numeric(5,2) NOT NULL DEFAULT 22.00,
  produzione integer NOT NULL DEFAULT 0,
  vetrina integer NOT NULL DEFAULT 0,
  varianti integer NOT NULL DEFAULT 0,
  seriali_imei integer NOT NULL DEFAULT 0,
  lotti_scadenze integer NOT NULL DEFAULT 0,
  spedizioni integer NOT NULL DEFAULT 1,
  servizi integer NOT NULL DEFAULT 0,
  digitale integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS store_config_activity_unique ON store_config(activity_id);

-- === Production Materials ===
CREATE TABLE IF NOT EXISTS production_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_materiale text NOT NULL,
  unita text NOT NULL,
  colore text,
  archiviato integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- === Material Batches ===
CREATE TABLE IF NOT EXISTS material_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES production_materials(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantita_totale numeric(18,6) NOT NULL,
  quantita_residua numeric(18,6) NOT NULL,
  costo_totale numeric(12,2) NOT NULL,
  costo_per_unita numeric(18,6) NOT NULL,
  lotto text,
  scadenza date,
  data_acquisto timestamp DEFAULT now(),
  cassa_coverage numeric(12,2) NOT NULL DEFAULT 0.00
);

-- === Product Showcase ===
CREATE TABLE IF NOT EXISTS product_showcase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_articolo text NOT NULL,
  categoria text,
  altezza numeric(10,2),
  larghezza numeric(10,2),
  lunghezza numeric(10,2),
  costo_previsto numeric(12,2) NOT NULL DEFAULT 0.00,
  archiviato integer NOT NULL DEFAULT 0,
  usato_almeno_una_volta integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- === Showcase Material Links ===
CREATE TABLE IF NOT EXISTS showcase_material_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showcase_id uuid NOT NULL REFERENCES product_showcase(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES production_materials(id) ON DELETE RESTRICT,
  quantita_per_pezzo numeric(18,6) NOT NULL
);
