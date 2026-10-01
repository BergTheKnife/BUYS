-- Stores uploaded inventory item photos directly in Postgres (Neon) instead
-- of on the server's local filesystem. Render recreates the container
-- filesystem from the repo on every deploy, so any image saved only to
-- /uploads or public/inventory-images at runtime is lost after the next
-- deploy. Storing the bytes in the database keeps them durable without
-- relying on any additional external storage service.
CREATE TABLE IF NOT EXISTS inventario_immagini (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dati bytea NOT NULL,
  mime_type text NOT NULL,
  created_at timestamp DEFAULT now()
);
