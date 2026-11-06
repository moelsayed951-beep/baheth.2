// ============================================================
// GET /api/proxy/google?q=...&sites=shamela.ws,noor-book.com&start=1
// وسيط البحث: يخفي المفاتيح (GOOGLE_API_KEY / GOOGLE_CSE_ID …) ويتجاوز مشكلة CORS
// لأن المتصفح يتصل بنفس نطاق الموقع فقط.
// ============================================================
import { HttpFail, checkOrigin, fail, json, readUserKey, toResponse, type PagesHandler } from '../../_lib/shared';
import { globalCap, ipLimit, rateLimit } from '../../_lib/limits';
import { authEnabled, consumeQuota, requireSession } from '../../_lib/auth';
import { PAGE_SIZE, maxStartFor, parseSites, pickProvider, runSearch } from '../../_lib/search';

const MAX_QUERY_LENGTH = 260; // يتسع لعبارات كلية التربية/القسم المضافة من الواجهة

export const onRequestGet: PagesHandler = async ({ request, env, waitUntil }) => {
  const blocked = checkOrigin(request, env);
  if (blocked) return blocked;

  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').replace(/[\u0000-\u001F]/g, ' ').trim();
    if (!q) throw new HttpFail(400, 'missing_query', 'اكتب كلمات البحث أولاً');
    if (q.length > MAX_QUERY_LENGTH) throw new HttpFail(400, 'query_too_long', `الحد الأقصى لطول البحث ${MAX_QUERY_LENGTH} حرفاً`);

    const sites = parseSites(url.searchParams.get('sites'));
    const startRaw = Number(url.searchParams.get('start') ?? '1');

    // مفتاح Tavily الخاص بالمستخدم (اختياري) يُستخدم بدل مفتاح الخادم فتكون الحصة حصته هو
    const userTavily = readUserKey(request, 'X-Search-Key');
    const searchEnv = userTavily ? { ...env, TAVILY_API_KEY: userTavily, SEARCH_PROVIDER: 'tavily' } : env;
    const provider = pickProvider(searchEnv);
    if (!provider) {
      return fail(503, 'not_configured', 'خدمة بحث الويب غير مفعّلة بعد: أضف مفاتيح البحث في إعدادات Cloudflare.');
    }
    const maxStart = maxStartFor(provider);
    const start = Number.isInteger(startRaw) && startRaw >= 1 && startRaw <= maxStart ? startRaw : 1;

    // تخزين مؤقت على الحافة لتوفير الحصة المجانية (نفس البحث خلال 30 دقيقة لا يستهلك طلباً جديداً)
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const hit = cache ? await cache.match(cacheKey) : undefined;
    if (hit) return hit;

    // بحث الويب بمفتاح الخادم يستهلك حصة المنصة المجانية: مع تفعيل الحسابات يلزم الدخول وتُحسب حصة يومية لكل حساب.
    // من يستخدم مفتاح Tavily الخاص به لا يُحسب عليه شيء.
    if (!userTavily) {
      await rateLimit(env, request, 'web', ipLimit(env, 'WEB_IP_HOURLY', 30), 3600);
      if (authEnabled(env)) {
        const session = await requireSession(request, env);
        await consumeQuota(env, session.sub, 'web');
      }
      await globalCap(env, 'web'); // سقف عام لحماية حصة Tavily الشهرية
    } else {
      await rateLimit(env, request, 'web-own', 300, 3600);
    }
    const hits = await runSearch(provider, searchEnv, q, sites, start);
    const nextStart = hits.length >= PAGE_SIZE && start + PAGE_SIZE <= maxStart ? start + PAGE_SIZE : null;

    const res = json({ provider, results: hits, nextStart }, 200, { 'Cache-Control': 'public, max-age=1800' });
    if (cache && hits.length > 0) {
      const store = cache.put(cacheKey, res.clone());
      if (waitUntil) waitUntil(store);
      else await store;
    }
    return res;
  } catch (err) {
    return toResponse(err);
  }
};
