// ============================================================
// أدوات مشتركة لدوال Cloudflare Pages Functions (تعمل على الخادم فقط)
// ⚠️ كل المفاتيح السرية تُقرأ من env (Cloudflare ← Settings ← Variables and Secrets)
//    ولا تُكتب هنا ولا في كود React أبداً.
// ============================================================

// المتغيرات السرية والإعدادات (تُضاف في لوحة Cloudflare كـ Secrets)
export interface Env {
  // --- البحث ---
  SEARCH_PROVIDER?: string; // google | tavily | serpapi | serper | brave (اختياري: يُكتشف تلقائياً من المفاتيح الموجودة)
  GOOGLE_API_KEY?: string; // 🔑 مفتاح Google Custom Search
  GOOGLE_CSE_ID?: string; // 🔑 معرّف محرك البحث المخصص (cx)
  SERPER_API_KEY?: string; // 🔑 بديل (serper.dev)
  BRAVE_API_KEY?: string; // 🔑 بديل (Brave Search API)
  TAVILY_API_KEY?: string; // 🔑 بديل (Tavily) — الأسهل للمبتدئين
  SERPAPI_API_KEY?: string; // 🔑 بديل (SerpApi) — نتائج جوجل الحقيقية
  // --- الذكاء الاصطناعي ---
  GEMINI_API_KEY?: string; // 🔑 Google Gemini (الافتراضي)
  XAI_API_KEY?: string; // 🔑 Grok من xAI (اختياري) — من console.x.ai؛ كل طلب يستهلك رصيد صاحب المفتاح
  OPENAI_API_KEY?: string; // 🔑 OpenAI (اختياري)
  DEEPSEEK_API_KEY?: string; // 🔑 DeepSeek (اختياري)
  GEMINI_MODEL?: string; // اختياري: يغيّر النموذج دون تعديل الكود
  OPENAI_MODEL?: string;
  DEEPSEEK_MODEL?: string;
  GROK_MODEL?: string;
  GEMINI_FALLBACK_MODELS?: string; // قائمة نماذج احتياطية مفصولة بفاصلة (الافتراضي gemini-2.5-flash-lite). ملاحظة: gemini-1.5-flash متوقف رسمياً منذ 29/9/2025
  S2_API_KEY?: string; // 🔑 مفتاح Semantic Scholar الخاص بالمنصة (احتياطي إن لم يضع المستخدم مفتاحه)
  ZENODO_ACCESS_TOKEN?: string; // 🔑 اختياري: رمز وصول Zenodo إن رفض الخادم الطلبات المجهولة (403)
  AI_HOURLY_LIMIT?: string; // اختياري: الحد الأقصى لطلبات المساعد الذكي لكل زائر في الساعة (الافتراضي 30)
  // --- مصادر أكاديمية جديدة (كلها مجانية) ---
  NCBI_API_KEY?: string; // اختياري: يرفع حد PubMed من 3 إلى 10 طلبات/ثانية (مجاني من NCBI)
  MYMEMORY_EMAIL?: string; // اختياري: بريدك لرفع حصة الترجمة المجانية اليومية لدى MyMemory
  BASE_USER_AGENT?: string; // اختياري: تعريف التطبيق لدى BASE (يتطلب تسجيل عنوان IP لدى BASE)
  CACHE?: KVNamespaceLike; // ربط KV اسمه CACHE (تخزين مؤقت 30 دقيقة). اختياري: بدونه يُستخدم كاش الحافة
  // --- حسابات المستخدمين (Google + D1) — اختيارية: بدونها تعمل المنصة بلا تسجيل دخول ---
  GOOGLE_CLIENT_ID?: string; // معرّف عميل OAuth (عام وليس سراً) من Google Cloud Console
  SESSION_SECRET?: string; // 🔑 سر عشوائي طويل (32+ حرفاً) لتوقيع جلسات الدخول
  DB?: D1Like; // ربط D1 باسم DB
  WEB_DAILY_LIMIT?: string; // طلبات بحث الويب/المكتبات العربية لكل حساب يومياً (الافتراضي 40)
  AI_DAILY_LIMIT?: string; // طلبات المساعد الذكي بمفاتيح الخادم لكل حساب يومياً (الافتراضي 20)
  // --- حدود الحماية من الاستنزاف (كلها اختيارية ولها قيم افتراضية آمنة) ---
  WEB_GLOBAL_DAILY_CAP?: string; // سقف يومي لكل المستخدمين لطلبات بحث الويب (Tavily). الافتراضي 100: اضبطه على حصتك الشهرية ÷ 30
  TRANSLATE_GLOBAL_DAILY_CAP?: string; // الافتراضي 150
  AI_GLOBAL_DAILY_CAP?: string; // لمفاتيح الذكاء الخاصة بالمنصة فقط. الافتراضي 300
  WEB_IP_HOURLY?: string; // الافتراضي 30
  SOURCE_IP_HOURLY?: string; // الافتراضي 600
  TRANSLATE_IP_HOURLY?: string; // الافتراضي 40
  AI_IP_HOURLY?: string; // الافتراضي 60
  AUTH_IP_HOURLY?: string; // الافتراضي 30
  LIBRARY_IP_HOURLY?: string; // الافتراضي 600
  CORE_API_KEY?: string; // 🔑 مفتاح CORE (على الخادم فقط — لا تضعه بمتغير VITE_)
  // --- حماية ---
  ALLOWED_ORIGINS?: string; // اختياري: نطاقات إضافية مسموحة، مفصولة بفواصل (مثل نطاق معاينة)
}

// الحد الأدنى من واجهة Cloudflare KV
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

// الحد الأدنى من واجهة Cloudflare D1
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Like { prepare(query: string): D1Stmt }

// الحد الأدنى من نوع سياق Pages Functions (دون الحاجة لحزمة @cloudflare/workers-types)
export interface PagesContext {
  request: Request;
  env: Env;
  waitUntil?: (p: Promise<unknown>) => void;
}
export type PagesHandler = (ctx: PagesContext) => Promise<Response> | Response;

const NO_STORE = { 'Cache-Control': 'no-store' };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE, ...headers }
  });
}

// أخطاء موحّدة بالعربية: { error, code }
export function fail(status: number, code: string, error: string): Response {
  return json({ error, code }, status);
}

// يمنع استخدام الوسيط من مواقع أخرى (استنزاف الحصة): الطلب يجب أن يأتي من نفس النطاق أو من نطاق مسموح.
// الطلبات من نفس الموقع لا تحتاج CORS أصلاً، لذلك لا نضيف أي ترويسات Access-Control.
export function checkOrigin(request: Request, env: Env): Response | null {
  // المتصفح يرسل Sec-Fetch-Site؛ طلب من موقع آخر يُرفض فوراً
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return fail(403, 'cross_site', 'هذا الطلب غير مسموح من موقع آخر');
  const origin = request.headers.get('Origin');
  if (!origin) return null; // طلبات المتصفح من نفس الموقع (GET) قد لا ترسل Origin
  let host = '';
  try {
    host = new URL(origin).host;
  } catch {
    return fail(403, 'bad_origin', 'مصدر الطلب غير صالح');
  }
  const self = new URL(request.url).host;
  const extra = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const allowed = host === self || extra.some((e) => e === origin || e === host);
  return allowed ? null : fail(403, 'forbidden_origin', 'هذا الطلب غير مسموح من هذا الموقع');
}

// قراءة JSON من جسم الطلب بحدّ أقصى للحجم
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpFail(413, 'too_large', 'حجم الطلب كبير جداً');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpFail(400, 'bad_json', 'صيغة الطلب غير صحيحة');
  }
}

// خطأ يُحوَّل إلى استجابة JSON
export class HttpFail extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toResponse(err: unknown): Response {
  if (err instanceof HttpFail) return fail(err.status, err.code, err.message);
  return fail(500, 'internal', 'حدث خطأ غير متوقع في الخادم');
}

// رسالة عربية مناسبة لحالة الرد من المزوّد الخارجي (دون تسريب أي تفاصيل حساسة)
export function upstreamFailure(status: number, what: string): HttpFail {
  if (status === 429) return new HttpFail(429, 'quota', `تم تجاوز الحد المسموح لدى ${what}. حاول لاحقاً.`);
  if (status === 401 || status === 403) {
    return new HttpFail(502, 'upstream_auth', `${what} رفض الطلب (المفتاح غير صالح أو الخدمة غير مفعّلة لهذا الحساب).`);
  }
  if (status === 404) return new HttpFail(502, 'upstream_not_found', `${what}: المورد أو النموذج غير موجود (راجع اسم النموذج/المعرّف).`);
  return new HttpFail(502, 'upstream_error', `تعذر الاتصال بـ ${what} (HTTP ${status}).`);
}

// جلب مع مهلة زمنية
export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new HttpFail(504, 'timeout', 'انتهت مهلة الاتصال بالمزوّد الخارجي');
    }
    throw new HttpFail(502, 'network', 'تعذر الوصول إلى المزوّد الخارجي');
  }
}

// تنظيف نص قادم من الخارج: إزالة وسوم HTML وفك أهم الكيانات
export function plainText(input: string): string {
  return input
    // وسوم التنسيق المضمّنة تُحذف بلا مسافة (حتى لا ينتج «word .»)، وبقية الوسوم تُستبدل بمسافة
    .replace(/<\/?(?:b|i|em|strong|sub|sup|span|a|u|mark|small)\b[^>]*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// يقبل روابط http/https فقط (يمنع javascript: وغيرها)
export function safeHttpUrl(u: string): string | null {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// نطاق صالح مثل shamela.ws (بدون بروتوكول أو مسار)
const HOST_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
export function validHostname(h: string): boolean {
  return HOST_RE.test(h);
}

// مفتاح يرسله المستخدم في ترويسة (BYOK): نقبل رموز المفاتيح المعتادة فقط
export function readUserKey(request: Request, header: string): string | undefined {
  const v = (request.headers.get(header) ?? '').trim();
  if (!v) return undefined;
  if (!/^[A-Za-z0-9_\-.:]{8,300}$/.test(v)) throw new HttpFail(400, 'bad_key', 'صيغة المفتاح غير صالحة');
  return v;
}

// حد استخدام لكل زائر (حسب IP) في الساعة لحماية رصيد مفاتيح الذكاء الاصطناعي المدفوعة.
// يعمل عند ربط KV باسم CACHE؛ بدونه لا يوجد تخزين مشترك بين نسخ الخادم فلا يمكن العدّ بدقة، فيُتخطى.
export async function checkRateLimit(request: Request, env: Env, bucket: string, defaultMax: number, limitVar?: string): Promise<void> {
  if (!env.CACHE) return;
  const max = Number(limitVar) > 0 ? Number(limitVar) : defaultMax;
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const key = `rl:${bucket}:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
  const used = Number((await env.CACHE.get(key).catch(() => null)) ?? '0');
  if (used >= max) throw new HttpFail(429, 'rate_limited', 'وصلت إلى الحد الأقصى لاستخدام المساعد الذكي هذه الساعة. حاول لاحقاً.');
  await env.CACHE.put(key, String(used + 1), { expirationTtl: 3700 }).catch(() => undefined);
}
