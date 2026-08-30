import { fetchText } from '../utils/http';
import { canonicalize } from '../utils/url';

function locsFromXml(xml: string) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m => m[1].trim().replace(/&amp;/g,'&'));
}

export async function discoverProductUrls(baseUrl: string, platform: string) {
  const candidates = [
    '/sitemap.xml','/sitemap_index.xml','/product-sitemap.xml','/wp-sitemap.xml','/sitemap_products_1.xml'
  ];
  const found = new Set<string>();
  let method = 'generic-crawl';

  for (const path of candidates) {
    try {
      const u = new URL(path, baseUrl).toString();
      const res = await fetchText(u, 8000);
      if (res.status >= 400 || !res.text.includes('<loc>')) continue;
      method = 'sitemap';
      const level1 = locsFromXml(res.text);
      for (const loc of level1.slice(0, 60)) {
        if (/sitemap/i.test(loc) && !/\.(html?|php)$/i.test(loc)) {
          try {
            const nested = await fetchText(loc, 8000);
            for (const x of locsFromXml(nested.text)) {
              if (looksLikeProductUrl(x, platform)) found.add(canonicalize(x));
            }
          } catch {}
        } else if (looksLikeProductUrl(loc, platform)) found.add(canonicalize(loc));
      }
      if (found.size) break;
    } catch {}
  }

  if (platform === 'shopify') {
    try {
      const res = await fetchText(new URL('/products.json?limit=250', baseUrl).toString());
      if (res.status < 400) {
        const data = JSON.parse(res.text);
        for (const p of data.products || []) found.add(canonicalize(`/products/${p.handle}`, baseUrl));
        if (found.size) method = 'shopify-api';
      }
    } catch {}
  }

  if (!found.size) {
    const home = await fetchText(baseUrl);
    for (const m of home.text.matchAll(/href=["']([^"']+)["']/gi)) {
      try {
        const u = canonicalize(m[1], baseUrl);
        if (new URL(u).host === new URL(baseUrl).host && looksLikeProductUrl(u, platform)) found.add(u);
      } catch {}
    }
  }

  return { urls: [...found].slice(0, 2000), method };
}

function looksLikeProductUrl(url: string, platform: string) {
  const p = new URL(url).pathname.toLowerCase();
  if (/cart|carrinho|checkout|login|account|busca|search|blog|tag|categoria|category/.test(p)) return false;
  if (platform === 'shopify') return p.includes('/products/');
  if (platform === 'woocommerce') return p.includes('/produto/') || p.includes('/product/');
  return /produto|product|p\//.test(p);
}
