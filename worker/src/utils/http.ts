export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS'
  }
});

export async function fetchText(url: string, timeoutMs = 12000): Promise<{status:number,text:string,headers:Headers}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'FeedSaaSBot/0.1 (+product-feed-generator)' }
    });
    return { status: res.status, text: await res.text(), headers: res.headers };
  } finally { clearTimeout(timer); }
}
