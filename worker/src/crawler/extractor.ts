import { fetchText } from '../utils/http';
import { canonicalize } from '../utils/url';
import type { Product } from '../types';

function stripHtml(s='') { return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }

function pickProductJsonLd(html: string): any | null {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1]);
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const n of nodes) {
        const t = n?.['@type'];
        if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) return n;
      }
    } catch {}
  }
  return null;
}

export async function extractProduct(url: string): Promise<Product | null> {
  const res = await fetchText(url);
  if (res.status >= 400) return null;
  const html = res.text;
  const p = pickProductJsonLd(html);
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]) || url;
  if (p) {
    const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers || {};
    const image = Array.isArray(p.image) ? p.image[0] : (typeof p.image === 'object' ? p.image?.url : p.image);
    const rawAvail = String(offer.availability || '').toLowerCase();
    const availability = rawAvail.includes('outofstock') ? 'out_of_stock' : rawAvail.includes('preorder') ? 'preorder' : rawAvail.includes('backorder') ? 'backorder' : 'in_stock';
    const rawBrand = typeof p.brand === 'object' ? p.brand?.name : p.brand;
    const price = Number(String(offer.price ?? offer.lowPrice ?? '').replace(',','.'));
    const id = String(p.sku || p.gtin13 || p.gtin || p.productID || canonical);
    return {
      id, externalId: p.productID ? String(p.productID) : undefined, sku: p.sku ? String(p.sku) : undefined,
      gtin: p.gtin13 || p.gtin || p.gtin14 || p.gtin12, mpn: p.mpn,
      title: stripHtml(p.name || ''), description: stripHtml(p.description || ''), url: canonicalize(url), canonicalUrl: canonicalize(canonical, url),
      imageUrl: image ? new URL(image, url).toString() : undefined, price: Number.isFinite(price) ? price : undefined,
      currency: offer.priceCurrency || 'BRL', availability, brand: rawBrand, category: p.category, condition: 'new'
    };
  }

  const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || html.match(/<title[^>]*>([^<]+)/i)?.[1];
  const image = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1];
  const priceRaw = html.match(/(?:product:price:amount|price)["'][^>]+content=["']([\d.,]+)/i)?.[1];
  if (!title) return null;
  const price = priceRaw ? Number(priceRaw.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.')) : undefined;
  return { id: canonical, title: stripHtml(title), url: canonicalize(url), canonicalUrl: canonicalize(canonical,url), imageUrl: image, price, currency:'BRL', availability:'in_stock', condition:'new' };
}
