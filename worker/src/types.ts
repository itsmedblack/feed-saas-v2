export interface Env {
  DB: D1Database;
  FEEDS: KVNamespace;
}

export interface Product {
  id: string;
  externalId?: string;
  sku?: string;
  gtin?: string;
  mpn?: string;
  title: string;
  description?: string;
  url: string;
  canonicalUrl: string;
  imageUrl?: string;
  price?: number;
  salePrice?: number;
  currency: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'backorder';
  brand?: string;
  category?: string;
  condition?: string;
  hash?: string;
}
