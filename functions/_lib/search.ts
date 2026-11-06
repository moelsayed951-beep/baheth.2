// ============================================================
// محوّلات (Adapters) محركات البحث على الخادم
// الواجهة الأمامية لا تعرف أي مزوّد؛ تستقبل صيغة موحّدة WebHit فقط.
//
// ⚠️ تنبيه مهم: واجهة Google Custom Search JSON API أُغلقت أمام العملاء الجدد
//    (منذ يناير 2026) وستتوقف نهائياً في 1 يناير 2027. لذلك أُضيف مزوّدان بديلان
//    (serper / brave) بنفس الواجهة. التبديل بينها يتم بمتغيّر SEARCH_PROVIDER فقط.
// ============================================================
import { HttpFail, fetchWithTimeout, plainText, safeHttpUrl, upstreamFailure, validHostname, type Env } from './shared';

export type SearchProviderId = 'google' | 'tavily' | 'serpapi' | 'serper' | 'brave';

export interface WebHit {
  title: string;
  url: string;
  snippet: string;
  displayLink: string;
}

export const PAGE_SIZE = 10;
export const MAX_START = 91; // حد Google: start + num ≤ 101 (أي 100 نتيجة كحد أقصى لكل استعلام)

// المزوّد النشط: الصريح أولاً، وإلا أول مزوّد مفاتيحه موجودة
export function pickProvider(env: Env): SearchProviderId | null {
  const has: Record<SearchProviderId, boolean> = {
    google: Boolean(env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID),
    tavily: Boolean(env.TAVILY_API_KEY),
    serpapi: Boolean(env.SERPAPI_API_KEY),
    serper: Boolean(env.SERPER_API_KEY),
    brave: Boolean(env.BRAVE_API_KEY)
  };
  const wanted = (env.SEARCH_PROVIDER ?? '').toLowerCase() as SearchProviderId;
  if (wanted in has) return has[wanted] ? wanted : null;
  return (['google', 'tavily', 'serpapi', 'serper', 'brave'] as const).find((p) => has[p]) ?? null;
}

// بناء نص الاستعلام: القيود على المواقع تُبنى هنا على الخادم من نطاقات تم التحقق منها فقط
export function buildQuery(q: string, sites: string[]): string {
  if (sites.length === 0) return q;
  const clause = sites.map((s) => `site:${s}`).join(' OR ');
  return `${q} (${clause})`;
}

export function parseSites(raw: string | null): string[] {
  if (!raw) return [];
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (list.length > 5) throw new HttpFail(400, 'too_many_sites', 'الحد الأقصى 5 مواقع في كل بحث');
  for (const s of list) {
    if (!validHostname(s)) throw new HttpFail(400, 'bad_site', `نطاق غير صالح: ${s.slice(0, 40)}`);
  }
  return [...new Set(list)];
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function toHit(title: unknown, link: unknown, snippet: unknown, display?: unknown): WebHit | null {
  if (typeof title !== 'string' || typeof link !== 'string') return null;
  const url = safeHttpUrl(link);
  if (!url) return null;
  return {
    title: plainText(title) || url,
    url,
    snippet: typeof snippet === 'string' ? plainText(snippet) : '',
    displayLink: typeof display === 'string' && display ? display : hostOf(url)
  };
}

/* ---------------- Google Custom Search ---------------- */
interface GoogleResp { items?: { title?: string; link?: string; snippet?: string; displayLink?: string }[] }

async function viaGoogle(env: Env, query: string, start: number): Promise<WebHit[]> {
  // 🔑 المفتاح ومعرّف المحرك يُقرآن من Secrets ولا يصلان للمتصفح
  const params = new URLSearchParams({
    key: env.GOOGLE_API_KEY ?? '',
    cx: env.GOOGLE_CSE_ID ?? '',
    q: query,
    num: String(PAGE_SIZE),
    start: String(start),
    hl: 'ar',
    fields: 'items(title,link,snippet,displayLink)'
  });
  const res = await fetchWithTimeout(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, { headers: { Accept: 'application/json' } }, 12000);
  if (!res.ok) throw upstreamFailure(res.status, 'Google Custom Search');
  const data = (await res.json()) as GoogleResp;
  return (data.items ?? []).map((i) => toHit(i.title, i.link, i.snippet, i.displayLink)).filter((h): h is WebHit => h !== null);
}

/* ---------------- Serper (نتائج جوجل عبر وسيط تجاري) ---------------- */
interface SerperResp { organic?: { title?: string; link?: string; snippet?: string }[] }

async function viaSerper(env: Env, query: string, start: number): Promise<WebHit[]> {
  const page = Math.floor((start - 1) / PAGE_SIZE) + 1;
  const res = await fetchWithTimeout(
    'https://google.serper.dev/search',
    {
      method: 'POST',
      headers: { 'X-API-KEY': env.SERPER_API_KEY ?? '', 'Content-Type': 'application/json' }, // 🔑
      body: JSON.stringify({ q: query, num: PAGE_SIZE, page, hl: 'ar' })
    },
    12000
  );
  if (!res.ok) throw upstreamFailure(res.status, 'Serper');
  const data = (await res.json()) as SerperResp;
  return (data.organic ?? []).map((i) => toHit(i.title, i.link, i.snippet)).filter((h): h is WebHit => h !== null);
}

/* ---------------- Brave Search ---------------- */
interface BraveResp { web?: { results?: { title?: string; url?: string; description?: string }[] } }

async function viaBrave(env: Env, query: string, start: number): Promise<WebHit[]> {
  const params = new URLSearchParams({ q: query, count: String(PAGE_SIZE), offset: String(Math.floor((start - 1) / PAGE_SIZE)) });
  const res = await fetchWithTimeout(
    `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
    { headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY ?? '' } }, // 🔑
    12000
  );
  if (!res.ok) throw upstreamFailure(res.status, 'Brave Search');
  const data = (await res.json()) as BraveResp;
  return (data.web?.results ?? []).map((i) => toHit(i.title, i.url, i.description)).filter((h): h is WebHit => h !== null);
}

/* ---------------- Tavily ---------------- */
// Tavily لا يدعم الترقيم (start)، لذلك نطلب عدداً أكبر (حتى 20) ونقتطع الصفحة المطلوبة.
interface TavilyResp { results?: { title?: string; url?: string; content?: string }[] }
export const TAVILY_MAX_RESULTS = 20;

async function viaTavily(env: Env, q: string, sites: string[], start: number): Promise<WebHit[]> {
  const res = await fetchWithTimeout(
    'https://api.tavily.com/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.TAVILY_API_KEY ?? ''}` }, // 🔑
      body: JSON.stringify({
        query: q,
        search_depth: 'basic', // رصيد واحد لكل بحث
        max_results: Math.min(TAVILY_MAX_RESULTS, start + PAGE_SIZE - 1),
        ...(sites.length ? { include_domains: sites } : {}) // تقييد المواقع الرسمي في Tavily (بدل site:)
      })
    },
    15000
  );
  if (!res.ok) throw upstreamFailure(res.status, 'Tavily');
  const data = (await res.json()) as TavilyResp;
  return (data.results ?? []).slice(start - 1, start - 1 + PAGE_SIZE).map((i) => toHit(i.title, i.url, i.content)).filter((h): h is WebHit => h !== null);
}

/* ---------------- SerpApi (نتائج جوجل الحقيقية) ---------------- */
interface SerpApiResp { organic_results?: { title?: string; link?: string; snippet?: string; displayed_link?: string }[]; error?: string }

async function viaSerpApi(env: Env, query: string, start: number): Promise<WebHit[]> {
  const params = new URLSearchParams({ engine: 'google', q: query, api_key: env.SERPAPI_API_KEY ?? '', start: String(start - 1), hl: 'ar' }); // 🔑
  const res = await fetchWithTimeout(`https://serpapi.com/search.json?${params.toString()}`, { headers: { Accept: 'application/json' } }, 20000);
  if (!res.ok) throw upstreamFailure(res.status, 'SerpApi');
  const data = (await res.json()) as SerpApiResp;
  // SerpApi يرجع خطأ بصيغة JSON عند عدم وجود نتائج؛ لا نعدّه فشلاً
  return (data.organic_results ?? []).map((i) => toHit(i.title, i.link, i.snippet)).filter((h): h is WebHit => h !== null);
}

// آخر رقم بداية مسموح لكل مزوّد (Tavily محدود بـ 20 نتيجة)
export function maxStartFor(provider: SearchProviderId): number {
  return provider === 'tavily' ? TAVILY_MAX_RESULTS - PAGE_SIZE + 1 : MAX_START;
}

export async function runSearch(provider: SearchProviderId, env: Env, q: string, sites: string[], start: number): Promise<WebHit[]> {
  if (provider === 'tavily') return viaTavily(env, q, sites, start);
  const query = buildQuery(q, sites);
  if (provider === 'google') return viaGoogle(env, query, start);
  if (provider === 'serpapi') return viaSerpApi(env, query, start);
  if (provider === 'serper') return viaSerper(env, query, start);
  return viaBrave(env, query, start);
}
