import { fetchText } from '../utils/http';

export async function detectPlatform(baseUrl: string) {
  const { text, headers } = await fetchText(baseUrl);
  const h = text.toLowerCase();
  const server = (headers.get('server') || '').toLowerCase();
  if (h.includes('woocommerce') || h.includes('wp-content') || h.includes('woocommerce-block')) return 'woocommerce';
  if (h.includes('cdn.shopify.com') || h.includes('shopify-section') || headers.get('x-shopid')) return 'shopify';
  if (h.includes('tray.com.br') || h.includes('traycdn')) return 'tray';
  if (h.includes('nuvemshop') || h.includes('tiendanube')) return 'nuvemshop';
  if (h.includes('vtex') || server.includes('vtex')) return 'vtex';
  if (h.includes('magento')) return 'magento';
  return 'generic';
}
