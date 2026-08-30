import type { Env } from './types';
import { json } from './utils/http';
import { normalizeStoreUrl } from './utils/url';
import { detectPlatform } from './services/platformDetector';
import { scanShop } from './services/scanner';
import { ensureSchema } from './services/schema';

const VERSION = '0.3.0';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return json({ok:true});
    const url = new URL(request.url);

    try {
      await ensureSchema(env);

      if (request.method === 'GET' && url.pathname === '/api/health') {
        const row = await env.DB.prepare('SELECT COUNT(*) AS total FROM shops').first<{total:number}>();
        const probe = `health:${crypto.randomUUID()}`;
        await env.FEEDS.put(probe, 'ok', { expirationTtl: 60 });
        const kv = await env.FEEDS.get(probe);
        await env.FEEDS.delete(probe);
        return json({
          ok: true,
          database: 'connected',
          storage: kv === 'ok' ? 'connected' : 'error',
          shops: Number(row?.total || 0),
          version: VERSION
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/shops') {
        const body:any = await request.json();
        const domain = normalizeStoreUrl(body.url || '');
        const duplicate = await env.DB.prepare('SELECT id FROM shops WHERE domain=?').bind(domain).first();
        if (duplicate) return json({error:'Esta loja já está cadastrada.'},409);
        const platform = await detectPlatform(domain);
        const id = crypto.randomUUID();
        const feedToken = `f_${crypto.randomUUID().replaceAll('-','')}`;
        const name = body.name || new URL(domain).host;
        await env.DB.prepare(`INSERT INTO shops(id,user_id,name,domain,platform,status,schedule_type,feed_token,created_at) VALUES(?,?,?,?,?,'active','manual',?,?)`).bind(id,'demo',name,domain,platform,feedToken,new Date().toISOString()).run();
        const shop = await env.DB.prepare('SELECT * FROM shops WHERE id=?').bind(id).first();
        return json({ shop, feedUrl: `${url.origin}/feed/${feedToken}.xml` }, 201);
      }

      if (request.method === 'GET' && url.pathname === '/api/shops') {
        const shops = await env.DB.prepare(`
          SELECT s.*,
            (SELECT COUNT(*) FROM products p WHERE p.shop_id=s.id) AS product_count,
            j.status AS last_job_status,
            j.urls_analyzed AS last_urls_analyzed,
            j.products_found AS last_products_found,
            j.products_new AS last_products_new,
            j.products_updated AS last_products_updated,
            j.errors AS last_errors,
            j.started_at AS last_job_started_at,
            j.finished_at AS last_job_finished_at
          FROM shops s
          LEFT JOIN crawl_jobs j ON j.id=(
            SELECT id FROM crawl_jobs cj WHERE cj.shop_id=s.id ORDER BY cj.started_at DESC LIMIT 1
          )
          ORDER BY s.created_at DESC
        `).all();
        return json(shops.results || []);
      }

      const shopDetail = url.pathname.match(/^\/api\/shops\/([^/]+)$/);
      if (request.method === 'GET' && shopDetail) {
        const shop = await env.DB.prepare('SELECT * FROM shops WHERE id=?').bind(shopDetail[1]).first();
        if (!shop) return json({error:'Loja não encontrada'},404);
        return json(shop);
      }

      if (request.method === 'DELETE' && shopDetail) {
        const shop = await env.DB.prepare('SELECT * FROM shops WHERE id=?').bind(shopDetail[1]).first<any>();
        if (!shop) return json({error:'Loja não encontrada'},404);
        await env.DB.prepare('DELETE FROM crawl_jobs WHERE shop_id=?').bind(shopDetail[1]).run();
        await env.DB.prepare('DELETE FROM products WHERE shop_id=?').bind(shopDetail[1]).run();
        await env.DB.prepare('DELETE FROM shops WHERE id=?').bind(shopDetail[1]).run();
        if (shop.feed_token) await env.FEEDS.delete(`feed:${shop.feed_token}`);
        return json({ok:true});
      }

      const scan = url.pathname.match(/^\/api\/shops\/([^/]+)\/scan$/);
      if (request.method === 'POST' && scan) {
        const shop = await env.DB.prepare('SELECT * FROM shops WHERE id=?').bind(scan[1]).first();
        if (!shop) return json({error:'Loja não encontrada'},404);
        return json(await scanShop(env, shop));
      }

      const products = url.pathname.match(/^\/api\/shops\/([^/]+)\/products$/);
      if (request.method === 'GET' && products) {
        const query = (url.searchParams.get('q') || '').trim();
        const filter = url.searchParams.get('filter') || 'all';
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 1000), 1), 2000);
        let where = 'shop_id=?';
        const binds:any[] = [products[1]];
        if (query) {
          where += ' AND (title LIKE ? OR sku LIKE ? OR external_id LIKE ?)';
          const term = `%${query}%`;
          binds.push(term, term, term);
        }
        if (filter === 'in_stock') where += " AND availability='in_stock'";
        if (filter === 'out_of_stock') where += " AND availability='out_of_stock'";
        if (filter === 'missing_image') where += " AND (image_url IS NULL OR image_url='')";
        if (filter === 'missing_price') where += ' AND price IS NULL';
        if (filter === 'missing_gtin') where += " AND (gtin IS NULL OR gtin='')";
        if (filter === 'missing_brand') where += " AND (brand IS NULL OR brand='')";
        const stmt = env.DB.prepare(`SELECT * FROM products WHERE ${where} ORDER BY updated_at DESC LIMIT ${limit}`);
        const rows = await stmt.bind(...binds).all();
        return json(rows.results || []);
      }

      const health = url.pathname.match(/^\/api\/shops\/([^/]+)\/health$/);
      if (request.method === 'GET' && health) {
        const h = await env.DB.prepare(`SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN title IS NOT NULL AND title!='' AND url IS NOT NULL AND url!='' AND image_url IS NOT NULL AND image_url!='' AND price IS NOT NULL THEN 1 ELSE 0 END) AS valid,
          SUM(CASE WHEN image_url IS NULL OR image_url='' THEN 1 ELSE 0 END) AS missing_image,
          SUM(CASE WHEN price IS NULL THEN 1 ELSE 0 END) AS missing_price,
          SUM(CASE WHEN title IS NULL OR title='' THEN 1 ELSE 0 END) AS missing_title,
          SUM(CASE WHEN gtin IS NULL OR gtin='' THEN 1 ELSE 0 END) AS missing_gtin,
          SUM(CASE WHEN brand IS NULL OR brand='' THEN 1 ELSE 0 END) AS missing_brand,
          SUM(CASE WHEN category IS NULL OR category='' THEN 1 ELSE 0 END) AS missing_category,
          SUM(CASE WHEN availability='out_of_stock' THEN 1 ELSE 0 END) AS out_of_stock
          FROM products WHERE shop_id=?`).bind(health[1]).first<any>();
        const total = Number(h?.total || 0);
        const valid = Number(h?.valid || 0);
        return json({
          total,
          valid,
          score: total ? Math.round((valid / total) * 100) : 0,
          critical: {
            missingImage: Number(h?.missing_image || 0),
            missingPrice: Number(h?.missing_price || 0),
            missingTitle: Number(h?.missing_title || 0)
          },
          recommendations: {
            missingGtin: Number(h?.missing_gtin || 0),
            missingBrand: Number(h?.missing_brand || 0),
            missingCategory: Number(h?.missing_category || 0)
          },
          inventory: { outOfStock: Number(h?.out_of_stock || 0) }
        });
      }

      const jobs = url.pathname.match(/^\/api\/shops\/([^/]+)\/jobs$/);
      if (request.method === 'GET' && jobs) {
        const rows = await env.DB.prepare('SELECT * FROM crawl_jobs WHERE shop_id=? ORDER BY started_at DESC LIMIT 20').bind(jobs[1]).all();
        return json(rows.results || []);
      }

      const schedule = url.pathname.match(/^\/api\/shops\/([^/]+)\/schedule$/);
      if (request.method === 'PUT' && schedule) {
        const body:any = await request.json();
        const allowed = ['hourly','daily','weekly','biweekly','monthly','manual'];
        if (!allowed.includes(body.type)) return json({error:'Frequência inválida'},400);
        const hour = body.type === 'manual' || body.type === 'hourly' ? null : Math.min(23, Math.max(0, Number(body.hour ?? 3)));
        await env.DB.prepare('UPDATE shops SET schedule_type=?, schedule_hour=? WHERE id=?').bind(body.type, hour, schedule[1]).run();
        return json({ok:true, type:body.type, hour, timezone:'America/Sao_Paulo'});
      }

      const feed = url.pathname.match(/^\/feed\/([^/]+)\.xml$/);
      if (request.method === 'GET' && feed) {
        const xml = await env.FEEDS.get(`feed:${feed[1]}`);
        if (!xml) return new Response('Feed ainda não gerado', {status:404, headers:corsHeaders({'content-type':'text/plain; charset=utf-8'})});
        return new Response(xml, { headers: corsHeaders({'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=300'}) });
      }

      return json({name:'Feed SaaS API', version:VERSION, status:'online'}, 200);
    } catch (e:any) {
      return json({error: String(e?.message || e), hint:'Verifique o deploy e os recursos DB/FEEDS da Cloudflare.'}, 500);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await ensureSchema(env);
    const shops = await env.DB.prepare(`SELECT * FROM shops WHERE status='active' AND schedule_type!='manual'`).all();
    const now = new Date();
    for (const shop of shops.results || []) {
      if (isDue(shop as any, now)) {
        try { await scanShop(env, shop); } catch (e) { console.error('scheduled scan failed', (shop as any).id, e); }
      }
    }
  }
};

function corsHeaders(extra: Record<string,string> = {}) {
  return {
    'access-control-allow-origin':'*',
    'access-control-allow-headers':'content-type, authorization',
    'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS',
    ...extra
  };
}

function brasilHour(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'America/Sao_Paulo', hour:'2-digit', hour12:false }).formatToParts(now);
  return Number(parts.find(p => p.type === 'hour')?.value || 0);
}

function isDue(shop:any, now:Date) {
  if (!shop.last_scan) return true;
  const last = new Date(shop.last_scan);
  const hours = (now.getTime()-last.getTime())/3600000;
  const targetHour = shop.schedule_hour == null ? 3 : Number(shop.schedule_hour);
  const localHour = brasilHour(now);
  if (shop.schedule_type === 'hourly') return hours >= 1;
  if (shop.schedule_type === 'daily') return hours >= 20 && localHour === targetHour;
  if (shop.schedule_type === 'weekly') return hours >= 164 && localHour === targetHour;
  if (shop.schedule_type === 'biweekly') return hours >= 332 && localHour === targetHour;
  if (shop.schedule_type === 'monthly') return hours >= 24*27 && localHour === targetHour;
  return false;
}
