import type { Env } from '../types';

const statements = [
  `CREATE TABLE IF NOT EXISTS shops (
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
    feed_in_stock_only INTEGER NOT NULL DEFAULT 1,
    merchant_store_name TEXT,
    default_brand TEXT,
    google_product_category TEXT,
    feed_categories TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS products (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_url ON products(shop_id, canonical_url)`,
  `CREATE TABLE IF NOT EXISTS crawl_jobs (
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
  )`
];

let initialized = false;
let initializing: Promise<void> | null = null;

export async function ensureSchema(env: Env): Promise<void> {
  if (initialized) return;
  if (initializing) return initializing;

  initializing = (async () => {
    for (const sql of statements) {
      await env.DB.prepare(sql).run();
    }
    // Migração automática para instalações V3 existentes.
    try { await env.DB.prepare(`ALTER TABLE shops ADD COLUMN feed_in_stock_only INTEGER NOT NULL DEFAULT 1`).run(); } catch {}
    try { await env.DB.prepare(`ALTER TABLE shops ADD COLUMN merchant_store_name TEXT`).run(); } catch {}
    try { await env.DB.prepare(`ALTER TABLE shops ADD COLUMN default_brand TEXT`).run(); } catch {}
    try { await env.DB.prepare(`ALTER TABLE shops ADD COLUMN google_product_category TEXT`).run(); } catch {}
    try { await env.DB.prepare(`ALTER TABLE shops ADD COLUMN feed_categories TEXT`).run(); } catch {}
    try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN category_slug TEXT`).run(); } catch {}
    initialized = true;
  })();

  try {
    await initializing;
  } finally {
    initializing = null;
  }
}
