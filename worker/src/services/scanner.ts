import type { Env, Product } from '../types';
import { detectPlatform } from './platformDetector';
import { discoverProductUrls } from '../crawler/discovery';
import { extractProduct } from '../crawler/extractor';
import { generateGoogleXml } from '../feed/generator';

export async function scanShop(env: Env, shop: any) {
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO crawl_jobs(id,shop_id,status,started_at) VALUES(?,?,?,?)`).bind(jobId, shop.id, 'running', now).run();
  try {
    const platform = shop.platform && shop.platform !== 'unknown' ? shop.platform : await detectPlatform(shop.domain);
    const discovery = await discoverProductUrls(shop.domain, platform);
    let found = 0, created = 0, updated = 0, errors = 0;

    for (const url of discovery.urls) {
      try {
        const p = await extractProduct(url);
        if (!p) { errors++; continue; }
        found++;
        const existing = await env.DB.prepare('SELECT id FROM products WHERE shop_id=? AND canonical_url=?').bind(shop.id, p.canonicalUrl).first();
        const id = existing?.id || crypto.randomUUID();
        await upsertProduct(env, shop.id, id as string, p);
        existing ? updated++ : created++;
      } catch { errors++; }
    }

    const onlyAvailable = Number(shop.feed_in_stock_only ?? 1) === 1;
    const feedSql = onlyAvailable
      ? "SELECT * FROM products WHERE shop_id=? AND missing_count < 2 AND availability='in_stock'"
      : 'SELECT * FROM products WHERE shop_id=? AND missing_count < 2';
    const rows = await env.DB.prepare(feedSql).bind(shop.id).all();
    const xml = generateGoogleXml(shop.name || new URL(shop.domain).host, rows.results || []);
    await env.FEEDS.put(`feed:${shop.feed_token}`, xml, { metadata: { generatedAt: new Date().toISOString(), count: rows.results?.length || 0 } });
    const finished = new Date().toISOString();
    await env.DB.prepare(`UPDATE shops SET platform=?, discovery_method=?, last_scan=? WHERE id=?`).bind(platform, discovery.method, finished, shop.id).run();
    await env.DB.prepare(`UPDATE crawl_jobs SET status='done',urls_analyzed=?,products_found=?,products_new=?,products_updated=?,errors=?,finished_at=? WHERE id=?`).bind(discovery.urls.length,found,created,updated,errors,finished,jobId).run();
    return { jobId, platform, discoveryMethod: discovery.method, urls: discovery.urls.length, products: found, created, updated, errors };
  } catch (e:any) {
    await env.DB.prepare(`UPDATE crawl_jobs SET status='error', error_message=?, finished_at=? WHERE id=?`).bind(String(e?.message || e), new Date().toISOString(), jobId).run();
    throw e;
  }
}

async function upsertProduct(env: Env, shopId: string, id: string, p: Product) {
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO products(id,shop_id,external_id,sku,gtin,mpn,title,description,url,canonical_url,image_url,price,sale_price,currency,availability,brand,category,condition,updated_at,created_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(shop_id,canonical_url) DO UPDATE SET external_id=excluded.external_id,sku=excluded.sku,gtin=excluded.gtin,mpn=excluded.mpn,title=excluded.title,description=excluded.description,url=excluded.url,image_url=excluded.image_url,price=excluded.price,sale_price=excluded.sale_price,currency=excluded.currency,availability=excluded.availability,brand=excluded.brand,category=excluded.category,condition=excluded.condition,missing_count=0,updated_at=excluded.updated_at`).bind(
    id,shopId,p.externalId||null,p.sku||null,p.gtin||null,p.mpn||null,p.title,p.description||null,p.url,p.canonicalUrl,p.imageUrl||null,p.price??null,p.salePrice??null,p.currency,p.availability,p.brand||null,p.category||null,p.condition||'new',now,now
  ).run();
}
