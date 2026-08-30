export function normalizeStoreUrl(input: string) {
  let value = input.trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  const u = new URL(value);
  u.hash = '';
  return `${u.protocol}//${u.host}`;
}

export function canonicalize(raw: string, base?: string) {
  const u = new URL(raw, base);
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ref','page'].forEach(k => u.searchParams.delete(k));
  u.hash = '';
  return u.toString();
}
