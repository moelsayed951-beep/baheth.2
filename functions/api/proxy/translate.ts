// ============================================================
// GET /api/proxy/translate?q=<نص عربي>  →  { text: "<English>" }
// يترجم استعلام البحث العربي إلى الإنجليزية (MyMemory المجاني) لتوسيع البحث في القواعد العالمية.
// النتائج تُخزَّن 24 ساعة (KV أو كاش الحافة) لتوفير الحصة المجانية المشتركة.
// ============================================================
import { globalCap, ipLimit, rateLimit } from '../../_lib/limits';
import { HttpFail, checkOrigin, fetchWithTimeout, json, toResponse, type PagesHandler } from '../../_lib/shared';

const MAX_LEN = 200;
const TTL = 24 * 3600;
interface MyMemoryResp { responseStatus?: number | string; responseData?: { translatedText?: string } }

export const onRequestGet: PagesHandler = async ({ request, env }) => {
  const blocked = checkOrigin(request, env);
  if (blocked) return blocked;
  try {
    const q = (new URL(request.url).searchParams.get('q') ?? '').replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q) throw new HttpFail(400, 'missing_query', 'لا يوجد نص للترجمة');
    if (q.length > MAX_LEN) throw new HttpFail(400, 'query_too_long', 'النص طويل');
    if (!/[\u0600-\u06FF]/.test(q)) return json({ text: q });

    const key = `tr:${q.toLowerCase()}`;
    if (env.CACHE) {
      const hit = await env.CACHE.get(key).catch(() => null);
      if (hit) return json({ text: hit, cached: true }, 200, { 'Cache-Control': `public, max-age=${TTL}` });
    }

    await rateLimit(env, request, 'translate', ipLimit(env, 'TRANSLATE_IP_HOURLY', 40), 3600);
    await globalCap(env, 'translate');
    const params = new URLSearchParams({ q, langpair: 'ar|en' });
    if (env.MYMEMORY_EMAIL) params.set('de', env.MYMEMORY_EMAIL); // اختياري: يرفع الحصة اليومية المجانية
    const res = await fetchWithTimeout(`https://api.mymemory.translated.net/get?${params.toString()}`, { headers: { Accept: 'application/json' } }, 8000);
    if (!res.ok) throw new HttpFail(502, 'translate_failed', 'تعذرت الترجمة الآن');
    const data = (await res.json()) as MyMemoryResp;
    const text = (data.responseData?.translatedText ?? '').trim();
    // MyMemory يرجع رسائل تحذير بدل الترجمة عند نفاد الحصة؛ لا نعتمدها
    if (Number(data.responseStatus) !== 200 || !text || /MYMEMORY|QUERY LENGTH|INVALID/i.test(text) || /[\u0600-\u06FF]/.test(text)) {
      throw new HttpFail(502, 'translate_failed', 'تعذرت الترجمة الآن');
    }
    if (env.CACHE) await env.CACHE.put(key, text, { expirationTtl: TTL }).catch(() => undefined);
    return json({ text }, 200, { 'Cache-Control': `public, max-age=${TTL}` });
  } catch (err) {
    return toResponse(err);
  }
};
