const esc = (v: unknown) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

export interface GoogleFeedOptions {
  shopName: string;
  storeName?: string | null;
  defaultBrand?: string | null;
  googleProductCategory?: string | null;
}

export function generateGoogleXml(options: GoogleFeedOptions, products: any[]) {
  const storeName = String(options.storeName || options.shopName || '').trim();
  const defaultBrand = String(options.defaultBrand || '').trim();
  const googleCategory = String(options.googleProductCategory || '').trim();

  const items = products
    .filter(p => p.title && p.url && p.image_url && p.price != null)
    .map(p => {
      const brand = String(p.brand || defaultBrand || '').trim();
      const productType = String(p.category || '').trim();
      const additional = String(p.additional_images || '').trim();
      let additionalImages: string[] = [];
      if (additional) {
        try { const parsed = JSON.parse(additional); if (Array.isArray(parsed)) additionalImages = parsed.filter(Boolean).slice(0,10); }
        catch { additionalImages = additional.split(',').map(x=>x.trim()).filter(Boolean).slice(0,10); }
      }
      return `\n<item>
<g:id>${esc(p.external_id || p.sku || p.id)}</g:id>
<g:title>${esc(p.title)}</g:title>
<g:description>${esc(p.description || p.title)}</g:description>
<g:link>${esc(p.url)}</g:link>
<g:image_link>${esc(p.image_url)}</g:image_link>
${additionalImages.map(img=>`<g:additional_image_link>${esc(img)}</g:additional_image_link>`).join('\n')}
<g:availability>${esc(p.availability || 'in_stock')}</g:availability>
<g:price>${Number(p.price).toFixed(2)} ${esc(p.currency || 'BRL')}</g:price>
${p.sale_price != null ? `<g:sale_price>${Number(p.sale_price).toFixed(2)} ${esc(p.currency || 'BRL')}</g:sale_price>` : ''}
<g:condition>${esc(p.condition || 'new')}</g:condition>
${brand ? `<g:brand>${esc(brand)}</g:brand>` : ''}
${p.gtin ? `<g:gtin>${esc(p.gtin)}</g:gtin>` : ''}
${p.mpn ? `<g:mpn>${esc(p.mpn)}</g:mpn>` : ''}
${productType ? `<g:product_type>${esc(productType)}</g:product_type>` : ''}
${googleCategory ? `<g:google_product_category>${esc(googleCategory)}</g:google_product_category>` : ''}
${storeName ? `<g:custom_label_0>${esc(storeName)}</g:custom_label_0>` : ''}
</item>`;
    }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>${esc(storeName || options.shopName)}</title><link></link><description>Product feed</description>${items}\n</channel></rss>`;
}
