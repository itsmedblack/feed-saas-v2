const esc = (v: unknown) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

export function generateGoogleXml(shopName: string, products: any[]) {
  const items = products.filter(p => p.title && p.url && p.image_url && p.price != null).map(p => `\n<item>
<g:id>${esc(p.external_id || p.sku || p.id)}</g:id>
<g:title>${esc(p.title)}</g:title>
<g:description>${esc(p.description || p.title)}</g:description>
<g:link>${esc(p.url)}</g:link>
<g:image_link>${esc(p.image_url)}</g:image_link>
<g:availability>${esc(p.availability || 'in_stock')}</g:availability>
<g:price>${Number(p.price).toFixed(2)} ${esc(p.currency || 'BRL')}</g:price>
${p.sale_price != null ? `<g:sale_price>${Number(p.sale_price).toFixed(2)} ${esc(p.currency || 'BRL')}</g:sale_price>` : ''}
<g:condition>${esc(p.condition || 'new')}</g:condition>
${p.brand ? `<g:brand>${esc(p.brand)}</g:brand>` : ''}
${p.gtin ? `<g:gtin>${esc(p.gtin)}</g:gtin>` : ''}
${p.mpn ? `<g:mpn>${esc(p.mpn)}</g:mpn>` : ''}
</item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>${esc(shopName)}</title><link></link><description>Product feed</description>${items}\n</channel></rss>`;
}
