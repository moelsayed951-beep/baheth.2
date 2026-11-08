// ============================================================
// GET /api/proxy/source?src=pubmed|base|doaj|arxiv|europepmc|zenodo|hal&q=...&page=0
// وسيط موحّد للمصادر العالمية: يتجاوز CORS، يحمي المفاتيح، ويخزّن النتائج 30 دقيقة (Cloudflare KV، وإلا كاش الحافة).
// ============================================================
import { HttpFail, checkOrigin, json, toResponse, type PagesHandler } from '../../_lib/shared';
import { ipLimit, rateLimit } from '../../_lib/limits';
import { readUserKey } from '../../_lib/shared';
import { MAX_PAGE, PROXY_SOURCES, runSource, type ProxySourceId, type UnifiedResearchResult } from '../../_lib/sources';

const MAX_QUERY_LENGTH = 200;
const CACHE_TTL = 30 * 60; // 30 دقيقة

export const onRequestGet: PagesHandler = async ({ request, env, waitUntil }) => {
  const blocked = checkOrigin(request, env);
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const src = url.searchParams.get('src') as ProxySourceId | null;
    if (!src || !PROXY_SOURCES.includes(src)) throw new HttpFail(400, 'bad_source', 'مصدر غير معروف');
    const q = (url.searchParams.get('q') ?? '').replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q) throw new HttpFail(400, 'missing_query', 'اكتب كلمات البحث أولاً');
    if (q.length > MAX_QUERY_LENGTH) throw new HttpFail(400, 'query_too_long', `الحد الأقصى لطول البحث ${MAX_QUERY_LENGTH} حرفاً`);

    const pageRaw = Number(url.searchParams.get('page') ?? '0');
    const page = Number.isInteger(pageRaw) && pageRaw >= 0 && pageRaw <= MAX_PAGE ? pageRaw : 0;

    // مفاتيح المستخدم الخاصة (BYOK) لـ CORE وSemantic Scholar تُرسل في ترويسة وتُستعمل لهذا الطلب فقط؛ لا تُخزَّن ولا تدخل الكاش ولا تُسجَّل
    const userKey = src === 'core' ? readUserKey(request, 'X-User-Core-Key') : src === 'semanticscholar' ? readUserKey(request, 'X-User-S2-Key') : undefined;
    const year = (n: string | null): number | undefined => { const v = Number(n); return Number.isInteger(v) && v >= 1800 && v <= 2200 ? v : undefined; };
    const yearStart = src === 'semanticscholar' ? year(url.searchParams.get('ys')) : undefined;
    const yearEnd = src === 'semanticscholar' ? year(url.searchParams.get('ye')) : undefined;

    const kvKey = `src:${src}:${page}:${yearStart ?? ''}-${yearEnd ?? ''}:${q.toLowerCase()}`;
    const edge = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined;
    const edgeKey = new Request(`${url.origin}/api/proxy/source?src=${src}&q=${encodeURIComponent(q.toLowerCase())}&page=${page}&ys=${yearStart ?? ''}&ye=${yearEnd ?? ''}`);

    // 1) KV إن وُجد، 2) كاش الحافة كبديل
    if (env.CACHE) {
      const hit = await env.CACHE.get(kvKey).catch(() => null);
      if (hit) return json({ source: src, cached: true, results: JSON.parse(hit) as UnifiedResearchResult[] });
    } else if (edge) {
      const hit = await edge.match(edgeKey);
      if (hit) return hit;
    }

    // الحماية تُطبَّق عند الذهاب فعلياً للمزوّد (النتائج المخزّنة لا تُحسب)
    await rateLimit(env, request, userKey ? 'src-own' : 'src', userKey ? 1500 : ipLimit(env, 'SOURCE_IP_HOURLY', 600), 3600);
    const results = await runSource(src, env, q, page, { userKey, yearStart, yearEnd });
    const res = json({ source: src, cached: false, results }, 200, { 'Cache-Control': `public, max-age=${CACHE_TTL}` });
    if (results.length > 0) {
      const store = env.CACHE
        ? env.CACHE.put(kvKey, JSON.stringify(results), { expirationTtl: CACHE_TTL }).catch(() => undefined)
        : edge?.put(edgeKey, res.clone());
      if (store) { if (waitUntil) waitUntil(store); else await store; }
    }
    return res;
  } catch (err) {
    return toResponse(err);
  }
};
