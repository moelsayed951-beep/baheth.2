// ============================================================
// حماية الحصة من الاستنزاف — ثلاث طبقات:
//  1) حد لكل عنوان IP (rateLimit)
//  2) سقف يومي عام لكل خدمة محدودة الحصة (globalCap) كمفتاح إيقاف أخير
//  3) حصة لكل حساب (auth.ts) عند تفعيل الحسابات
// التخزين: D1 (الأدق) ← KV ← ذاكرة النسخة (أضعف، لأن كل نسخة تعدّ وحدها).
// للإنتاج: فعّل D1 وأضف قاعدة Rate Limiting من لوحة Cloudflare (WAF) كطبقة أمام الدوال.
// ============================================================
import { HttpFail, type Env } from './shared';

export const clientIp = (request: Request): string =>
  request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';

const memory = new Map<string, { n: number; exp: number }>();
const num = (v: string | undefined, def: number): number => (Number(v) > 0 ? Math.floor(Number(v)) : def);

async function bump(env: Env, key: string, windowSec: number): Promise<number> {
  const exp = Math.floor(Date.now() / 1000) + windowSec + 60;
  if (env.DB) {
    try {
      const row = await env.DB.prepare('INSERT INTO rate_limits (k, n, exp) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n').bind(key, exp).first<{ n: number }>();
      if (row) {
        if (Math.random() < 0.01) await env.DB.prepare('DELETE FROM rate_limits WHERE exp < ?').bind(Math.floor(Date.now() / 1000)).run().catch(() => undefined);
        return row.n;
      }
    } catch {
      /* الجدول غير منشأ بعد (لم تُنفَّذ migrations/0002) → نكمل بالبدائل */
    }
  }
  if (env.CACHE) {
    try {
      const n = Number((await env.CACHE.get(key)) ?? '0') + 1;
      await env.CACHE.put(key, String(n), { expirationTtl: Math.max(60, windowSec + 60) });
      return n;
    } catch {
      /* ننتقل للذاكرة */
    }
  }
  const now = Date.now();
  const hit = memory.get(key);
  if (!hit || hit.exp < now) {
    if (memory.size > 5000) memory.clear();
    memory.set(key, { n: 1, exp: now + (windowSec + 60) * 1000 });
    return 1;
  }
  hit.n += 1;
  return hit.n;
}

export async function rateLimit(env: Env, request: Request, bucket: string, max: number, windowSec: number, message?: string): Promise<void> {
  const slot = Math.floor(Date.now() / 1000 / windowSec);
  const n = await bump(env, `rl:${bucket}:${clientIp(request)}:${slot}`, windowSec);
  if (n > max) throw new HttpFail(429, 'rate_limited', message ?? 'طلبات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مجدداً.');
}

export type CapKind = 'web' | 'translate' | 'ai';
const CAP_DEFAULTS: Record<CapKind, number> = { web: 100, translate: 150, ai: 300 };
const CAP_VAR: Record<CapKind, (e: Env) => string | undefined> = {
  web: (e) => e.WEB_GLOBAL_DAILY_CAP, translate: (e) => e.TRANSLATE_GLOBAL_DAILY_CAP, ai: (e) => e.AI_GLOBAL_DAILY_CAP
};

// سقف يومي عام لكل المستخدمين معاً: يحمي حصة Tavily/MyMemory/مفاتيح الذكاء المدفوعة من النفاد.
export async function globalCap(env: Env, kind: CapKind): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const n = await bump(env, `cap:${kind}:${day}`, 86400);
  if (n > num(CAP_VAR[kind](env), CAP_DEFAULTS[kind])) {
    throw new HttpFail(503, 'capacity', 'بلغت المنصة حدّها اليومي لهذه الخدمة المجانية. حاول غداً، أو أضف مفتاحك الخاص من صفحة «مفاتيحي».');
  }
}

export const ipLimit = (env: Env, name: 'WEB_IP_HOURLY' | 'SOURCE_IP_HOURLY' | 'TRANSLATE_IP_HOURLY' | 'AI_IP_HOURLY' | 'AUTH_IP_HOURLY' | 'LIBRARY_IP_HOURLY', def: number): number =>
  num(env[name], def);

export function _resetLimitsForTests(): void { memory.clear(); }
