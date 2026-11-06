// ============================================================
// تسجيل الدخول بحساب Google + جلسات موقّعة (HMAC) + حصة يومية لكل حساب
// - رمز Google (ID token) يُتحقق منه محلياً بالتوقيع RS256 ومفاتيح Google العامة.
// - الجلسة كوكي HttpOnly موقّع (لا تُحفظ على الخادم)، فلا يقرؤها JavaScript.
// - الحصة والمفضلة في D1.
// ============================================================
import { HttpFail, fail, type Env, type D1Like } from './shared';

const COOKIE = 'baheth_session';
const SESSION_DAYS = 30;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface SessionUser { sub: string; email: string; name: string; picture: string }
interface SessionPayload extends SessionUser { exp: number }

export const authEnabled = (env: Env): boolean => Boolean(env.DB && env.GOOGLE_CLIENT_ID && env.SESSION_SECRET && env.SESSION_SECRET.length >= 32);

/* ---------- base64url ---------- */
function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- التحقق من رمز Google ---------- */
interface Jwk { kid: string; n: string; e: string; kty: string; alg?: string }
let certCache: { at: number; keys: Jwk[] } | null = null;

async function googleKeys(force = false): Promise<Jwk[]> {
  if (!force && certCache && Date.now() - certCache.at < 3_600_000) return certCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new HttpFail(502, 'google_certs', 'تعذر الاتصال بخدمة Google للتحقق من الدخول');
  const data = (await res.json()) as { keys?: Jwk[] };
  certCache = { at: Date.now(), keys: data.keys ?? [] };
  return certCache.keys;
}

interface GoogleClaims { iss?: string; aud?: string; sub?: string; email?: string; email_verified?: boolean | string; name?: string; picture?: string; exp?: number }

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<SessionUser> {
  const bad = () => new HttpFail(401, 'bad_token', 'تعذر التحقق من حساب Google');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw bad();
  const [h, p, sig] = parts;
  let header: { kid?: string; alg?: string };
  let claims: GoogleClaims;
  try {
    header = JSON.parse(dec.decode(b64urlDecode(h))) as { kid?: string; alg?: string };
    claims = JSON.parse(dec.decode(b64urlDecode(p))) as GoogleClaims;
  } catch {
    throw bad();
  }
  if (header.alg !== 'RS256' || !header.kid) throw bad();

  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) throw bad();

  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlDecode(sig), enc.encode(`${h}.${p}`));
  if (!ok) throw bad();

  const now = Math.floor(Date.now() / 1000);
  const issOk = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  if (!issOk || claims.aud !== clientId || !claims.exp || claims.exp < now || !claims.sub || !claims.email || !verified) throw bad();

  return { sub: claims.sub, email: claims.email, name: (claims.name ?? claims.email).slice(0, 120), picture: typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture.slice(0, 400) : '' };
}

/* ---------- الجلسة ---------- */
async function hmacKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET ?? ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionCookie(env: Env, user: SessionUser): Promise<string> {
  const payload: SessionPayload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(body)));
  return `${COOKIE}=${body}.${b64urlEncode(sig)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearSessionCookie = (): string => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('Cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export async function getSession(request: Request, env: Env): Promise<SessionUser | null> {
  if (!authEnabled(env)) return null;
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), b64urlDecode(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(dec.decode(b64urlDecode(body))) as SessionPayload;
    if (!p.exp || p.exp < Date.now() / 1000 || !p.sub) return null;
    return { sub: p.sub, email: p.email, name: p.name, picture: p.picture };
  } catch {
    return null;
  }
}

export async function requireSession(request: Request, env: Env): Promise<SessionUser> {
  const s = await getSession(request, env);
  if (!s) throw new HttpFail(401, 'login_required', 'سجّل الدخول بحساب Google للمتابعة (أو أضف مفتاحك الخاص من صفحة «مفاتيحي»).');
  return s;
}

// حماية CSRF للطلبات التي تغيّر البيانات: يجب أن يصل Origin ويطابق نطاق الموقع (أو نطاقاً مسموحاً)
export function checkMutationOrigin(request: Request, env: Env): Response | null {
  const origin = request.headers.get('Origin');
  if (!origin) return fail(403, 'no_origin', 'الطلب مرفوض');
  let host = '';
  try { host = new URL(origin).host; } catch { return fail(403, 'bad_origin', 'مصدر الطلب غير صالح'); }
  const extra = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return host === new URL(request.url).host || extra.includes(origin) || extra.includes(host) ? null : fail(403, 'forbidden_origin', 'هذا الطلب غير مسموح من هذا الموقع');
}

/* ---------- الحصة اليومية ---------- */
export type QuotaKind = 'web' | 'ai';
const today = (): string => new Date().toISOString().slice(0, 10);

export function limitFor(env: Env, kind: QuotaKind): number {
  const raw = Number(kind === 'web' ? env.WEB_DAILY_LIMIT : env.AI_DAILY_LIMIT);
  return raw > 0 ? Math.floor(raw) : kind === 'web' ? 40 : 20;
}

export async function consumeQuota(env: Env, sub: string, kind: QuotaKind): Promise<void> {
  const db = env.DB as D1Like;
  const row = await db
    .prepare('INSERT INTO usage (user_sub, day, kind, count) VALUES (?, ?, ?, 1) ON CONFLICT(user_sub, day, kind) DO UPDATE SET count = count + 1 RETURNING count')
    .bind(sub, today(), kind)
    .first<{ count: number }>();
  const limit = limitFor(env, kind);
  if ((row?.count ?? 1) > limit) {
    throw new HttpFail(429, 'daily_quota', `استهلكت حصتك اليومية (${limit} طلباً). تتجدد غداً، أو أضف مفتاحك الخاص من صفحة «مفاتيحي» لاستخدام بلا حد من حصتنا.`);
  }
}

export async function usageToday(env: Env, sub: string): Promise<Record<QuotaKind, { used: number; limit: number }>> {
  const db = env.DB as D1Like;
  const rows = (await db.prepare('SELECT kind, count FROM usage WHERE user_sub = ? AND day = ?').bind(sub, today()).all<{ kind: QuotaKind; count: number }>()).results;
  const used = (k: QuotaKind) => rows.find((r) => r.kind === k)?.count ?? 0;
  return { web: { used: used('web'), limit: limitFor(env, 'web') }, ai: { used: used('ai'), limit: limitFor(env, 'ai') } };
}
