CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'demo',
  name TEXT,
  domain TEXT NOT NULL,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  schedule_type TEXT NOT NULL DEFAULT 'manual',
  schedule_hour INTEGER,
  last_scan TEXT,
  next_scan TEXT,
  feed_token TEXT NOT NULL UNIQUE,
  discovery_method TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  external_id TEXT,
  sku TEXT,
  gtin TEXT,
  mpn TEXT,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  canonical_url TEXT,
  image_url TEXT,
  additional_images TEXT,
  price REAL,
  sale_price REAL,
  currency TEXT DEFAULT 'BRL',
  availability TEXT,
  brand TEXT,
  category TEXT,
  category_slug TEXT,
  condition TEXT DEFAULT 'new',
  hash TEXT,
  missing_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_url ON products(shop_id, canonical_url);

CREATE TABLE IF NOT EXISTS crawl_jobs (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  status TEXT NOT NULL,
  urls_analyzed INTEGER NOT NULL DEFAULT 0,
  products_found INTEGER NOT NULL DEFAULT 0,
  products_new INTEGER NOT NULL DEFAULT 0,
  products_updated INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);
