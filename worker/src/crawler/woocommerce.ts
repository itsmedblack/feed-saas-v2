import type { Product } from '../types';
import { canonicalize } from '../utils/url';

function stripHtml(s='') {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&')
    .replace(/&#8211;|&#8212;/g,'-')
    .replace(/\s+/g,' ')
    .trim();
}

function slugify(v='') {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/&amp;|&/g,' e ')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function money(raw: any, minorUnit: number): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  const n = Number(String(raw).replace(',','.'));
  if (!Number.isFinite(n)) return undefined;
  return n / Math.pow(10, Number.isFinite(minorUnit) ? minorUnit : 2);
}

function getBrand(p:any): string | undefined {
  const candidates = [
    p.brand?.name,
    Array.isArray(p.brands) ? p.brands[0]?.name : undefined,
    p.extensions?.woocommerceBrands?.brands?.[0]?.name,
    p.extensions?.['woocommerce-brands']?.brands?.[0]?.name,
  ];
  return candidates.find(v => typeof v === 'string' && v.trim())?.trim();
}

function normalizeProduct(p:any): Product | null {
  if (!p?.permalink || !p?.name) return null;
  const prices = p.prices || {};
  const minor = Number(prices.currency_minor_unit ?? 2);
  const normalPrice = money(prices.regular_price ?? prices.price, minor);
  const currentPrice = money(prices.price ?? prices.regular_price, minor);
  const sale = money(prices.sale_price, minor);
  const effectivePrice = currentPrice ?? normalPrice;
  const salePrice = sale != null && normalPrice != null && sale < normalPrice ? sale : undefined;

  const images = Array.isArray(p.images) ? p.images.map((x:any)=>x?.src).filter(Boolean) : [];
  const categories = Array.isArray(p.categories) ? p.categories : [];
  const primaryCategory = categories[0] || null;

  let availability: Product['availability'] = 'in_stock';
  if (p.is_in_stock === false || p.stock_status === 'outofstock') availability = 'out_of_stock';
  else if (p.stock_status === 'onbackorder' || p.backorders_allowed) availability = 'backorder';

  const permalink = canonicalize(p.permalink);
  return {
    id: String(p.id ?? p.sku ?? permalink),
    externalId: p.id != null ? String(p.id) : undefined,
    sku: p.sku ? String(p.sku) : undefined,
    title: stripHtml(p.name),
    description: stripHtml(p.description || p.short_description || p.summary || p.name),
    url: permalink,
    canonicalUrl: permalink,
    imageUrl: images[0],
    additionalImages: images.slice(1, 11),
    price: normalPrice ?? effectivePrice,
    salePrice,
    currency: prices.currency_code || 'BRL',
    availability,
    brand: getBrand(p),
    category: primaryCategory?.name ? stripHtml(primaryCategory.name) : undefined,
    categorySlug: primaryCategory?.slug ? String(primaryCategory.slug) : (primaryCategory?.name ? slugify(primaryCategory.name) : undefined),
    condition: 'new'
  };
}

/**
 * Tenta obter o catálogo usando a Store API pública do WooCommerce.
 * Não exige Consumer Key/Secret. Pagina até 100 itens por requisição.
 */
export async function fetchWooCommerceProducts(baseUrl: string): Promise<{products: Product[], method: string, attempted: boolean}> {
  const products: Product[] = [];
  const maxPages = 30; // até 3.000 produtos por scan nessa fase
  let attempted = false;

  for (let page=1; page<=maxPages; page++) {
    const endpoint = new URL('/wp-json/wc/store/v1/products', baseUrl);
    endpoint.searchParams.set('per_page','100');
    endpoint.searchParams.set('page', String(page));
    endpoint.searchParams.set('catalog_visibility','visible');

    let res: Response;
    try {
      res = await fetch(endpoint.toString(), {
        headers: {
          'accept':'application/json',
          'user-agent':'Mozilla/5.0 (compatible; ProductFeedEngine/0.3.4; +https://workers.dev)'
        },
        redirect:'follow'
      });
      attempted = true;
    } catch {
      break;
    }

    if (res.status === 400 && page > 1) break; // página fora do limite
    if (!res.ok) break;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('json')) break;

    let data:any;
    try { data = await res.json(); } catch { break; }
    if (!Array.isArray(data)) break;
    if (!data.length) break;

    for (const raw of data) {
      const p = normalizeProduct(raw);
      if (p) products.push(p);
    }

    if (data.length < 100) break;
  }

  // deduplicação por URL canônica
  const unique = [...new Map(products.map(p => [p.canonicalUrl, p])).values()];
  return { products: unique, method: unique.length ? 'woocommerce-store-api' : 'woocommerce-store-api-empty', attempted };
}
