import type { Env } from './types';
import { json } from './utils/http';
import { normalizeStoreUrl } from './utils/url';
import { detectPlatform } from './services/platformDetector';
import { scanShop } from './services/scanner';
import { ensureSchema } from './services/schema';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return json({ok:true});
    const url = new URL(request.url);

    try {
      await ensureSchema(env);

      if (request.method === 'GET' && url.pathname === '/api/health') {
        const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM shops").first<{total:number}>();
        const probe = `health:${crypto.randomUUID()}`;
        await env.FEEDS.put(probe, 'ok', { expirationTtl: 60 });
        const kv = await env.FEEDS.get(probe);
        await env.FEEDS.delete(probe);
        return json({
          ok: true,
          database: 'connected',
          storage: kv === 'ok' ? 'connected' : 'error',
          shops: Number(row?.total || 0),
          version: '0.2.0'
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/shops') {
        const body:any = await request.json();
        const domain = normalizeStoreUrl(body.url || '');
        const platform = await detectPlatform(domain);
        const id = crypto.randomUUID();
        const feedToken = `f_${crypto.randomUUID().replaceAll('-','')}`;
        const name = body.name || new URL(domain).host;
        await env.DB.prepare(`INSERT INTO shops(id,user_id,name,domain,platform,status,schedule_type,feed_token,created_at) VALUES(?,?,?,?,?,'active','manual',?,?)`).bind(id,'demo',name,domain,platform,feedToken,new Date().toISOString()).run();
        const shop = await env.DB.prepare('SELECT * FROM shops WHERE id=?').bind(id).first();
        return json({ shop, feedUrl: `${url.origin}/feed/${feedToken}.xml` }, 201);
      }

      if (request.method === 'GET' && url.pathname === '/api/shops') {
        const shops = await env.DB.prepare(`SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.shop_id=s.id) product_count FROM shops s ORDER BY created_at DESC`).all();
        return json(shops.results || []);
      }

      const scan = url.pathname.match(/^\/api\/shops\/([^/]+)\/scan$/);
      if (request.method === 'POST' && scan) {
        const shop = await env.DB.prepare('SELECT * FROM shops WHERE id=?').bind(scan[1]).first();
        if (!shop) return json({error:'Loja não encontrada'},404);
        return json(await scanShop(env, shop));
      }

      const products = url.pathname.match(/^\/api\/shops\/([^/]+)\/products$/);
      if (request.method === 'GET' && products) {
        const rows = await env.DB.prepare('SELECT * FROM products WHERE shop_id=? ORDER BY updated_at DESC LIMIT 1000').bind(products[1]).all();
        return json(rows.results || []);
      }

      const schedule = url.pathname.match(/^\/api\/shops\/([^/]+)\/schedule$/);
      if (request.method === 'PUT' && schedule) {
        const body:any = await request.json();
        const allowed = ['hourly','daily','weekly','biweekly','monthly','manual'];
        if (!allowed.includes(body.type)) return json({error:'Frequência inválida'},400);
        await env.DB.prepare('UPDATE shops SET schedule_type=?, schedule_hour=? WHERE id=?').bind(body.type, body.hour ?? null, schedule[1]).run();
        return json({ok:true});
      }

      const feed = url.pathname.match(/^\/feed\/([^/]+)\.xml$/);
      if (request.method === 'GET' && feed) {
        const xml = await env.FEEDS.get(`feed:${feed[1]}`);
        if (!xml) return new Response('Feed ainda não gerado', {status:404, headers:corsHeaders({'content-type':'text/plain; charset=utf-8'})});
        return new Response(xml, { headers: corsHeaders({'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=300'}) });
      }

      return json({name:'Feed SaaS API', version:'0.2.0', status:'online'}, 200);
    } catch (e:any) {
      return json({error: String(e?.message || e), hint:'Verifique o deploy e os recursos DB/FEEDS criados automaticamente pela Cloudflare.'}, 500);
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

function isDue(shop:any, now:Date) {
  if (!shop.last_scan) return true;
  const last = new Date(shop.last_scan);
  const hours = (now.getTime()-last.getTime())/3600000;
  if (shop.schedule_type === 'hourly') return hours >= 1;
  if (shop.schedule_type === 'daily') return hours >= 24 && (shop.schedule_hour == null || now.getUTCHours() === Number(shop.schedule_hour));
  if (shop.schedule_type === 'weekly') return hours >= 168;
  if (shop.schedule_type === 'biweekly') return hours >= 336;
  if (shop.schedule_type === 'monthly') return hours >= 24*28;
  return false;
}
