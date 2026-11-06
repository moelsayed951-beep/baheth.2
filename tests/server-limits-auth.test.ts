import { beforeEach, describe, expect, it } from 'vitest';
import { checkMutationOrigin, consumeQuota, createSessionCookie, getSession, usageToday, verifyGoogleIdToken, authEnabled } from '../functions/_lib/auth';
import { _resetLimitsForTests, globalCap, rateLimit } from '../functions/_lib/limits';
import { checkOrigin } from '../functions/_lib/shared';
import { authEnv, baseEnv, makeD1, makeKV, req, SECRET } from './helpers/env';

beforeEach(() => _resetLimitsForTests());

const user = { sub: '123', email: 'a@b.com', name: 'علي', picture: 'https://x/y.png' };
const cookieOf = async (env = authEnv(), u = user) => (await createSessionCookie(env, u)).split(';')[0];

describe('الجلسات', () => {
  it('تفعيل الحسابات يتطلب DB وClient ID وسراً طويلاً', () => {
    expect(authEnabled(authEnv())).toBe(true);
    expect(authEnabled(authEnv({ SESSION_SECRET: 'short' }))).toBe(false);
    expect(authEnabled(baseEnv())).toBe(false);
  });
  it('دورة كاملة صحيحة', async () => {
    const env = authEnv();
    const s = await getSession(req('/x', { cookie: await cookieOf(env) }), env);
    expect(s?.sub).toBe('123');
  });
  it('رفض توقيع معبوث به أو حمولة مزوّرة أو سر مختلف', async () => {
    const env = authEnv();
    const c = await cookieOf(env);
    expect(await getSession(req('/x', { cookie: c.slice(0, -3) + 'AAA' }), env)).toBeNull();
    const [name, val] = c.split('=');
    const sig = val.split('.')[1];
    const forged = Buffer.from(JSON.stringify({ ...user, sub: '999', exp: 9999999999 })).toString('base64url');
    expect(await getSession(req('/x', { cookie: `${name}=${forged}.${sig}` }), env)).toBeNull();
    expect(await getSession(req('/x', { cookie: c }), { ...env, SESSION_SECRET: 'y'.repeat(48) })).toBeNull();
  });
  it('كوكي الجلسة آمن: HttpOnly وSecure وSameSite', async () => {
    const full = await createSessionCookie(authEnv(), user);
    expect(full).toMatch(/HttpOnly/);
    expect(full).toMatch(/Secure/);
    expect(full).toMatch(/SameSite=Lax/);
  });
});

describe('حماية CSRF وأصل الطلب', () => {
  const env = authEnv();
  it('الطلبات المعدِّلة: بلا Origin أو من موقع آخر مرفوضة', () => {
    expect(checkMutationOrigin(new Request('https://baheth.test/a', { method: 'POST' }), env)?.status).toBe(403);
    expect(checkMutationOrigin(new Request('https://baheth.test/a', { method: 'POST', headers: { Origin: 'https://evil.com' } }), env)?.status).toBe(403);
    expect(checkMutationOrigin(new Request('https://baheth.test/a', { method: 'POST', headers: { Origin: 'https://baheth.test' } }), env)).toBeNull();
  });
  it('طلب GET من موقع آخر (Sec-Fetch-Site: cross-site) مرفوض', () => {
    expect(checkOrigin(new Request('https://baheth.test/a', { headers: { 'Sec-Fetch-Site': 'cross-site' } }), env)?.status).toBe(403);
    expect(checkOrigin(new Request('https://baheth.test/a', { headers: { 'Sec-Fetch-Site': 'same-origin' } }), env)).toBeNull();
  });
});

describe('التحقق من رمز Google (RS256 حقيقي)', () => {
  it('يقبل الصحيح ويرفض المخالف', async () => {
    const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1' }] }))) as typeof fetch;
    try {
      const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const token = async (claims: object) => {
        const h = b64({ alg: 'RS256', kid: 'k1' }); const p = b64(claims);
        const s = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`))).toString('base64url');
        return `${h}.${p}.${s}`;
      };
      const ok = { iss: 'https://accounts.google.com', aud: 'cid', sub: 's1', email: 'u@g.com', email_verified: true, name: 'N', exp: Math.floor(Date.now() / 1000) + 600 };
      expect((await verifyGoogleIdToken(await token(ok), 'cid')).email).toBe('u@g.com');
      for (const bad of [{ ...ok, aud: 'other' }, { ...ok, exp: 1 }, { ...ok, email_verified: false }, { ...ok, iss: 'https://evil' }]) {
        await expect(verifyGoogleIdToken(await token(bad), 'cid')).rejects.toMatchObject({ code: 'bad_token' });
      }
      await expect(verifyGoogleIdToken((await token(ok)).slice(0, -4) + 'AAAA', 'cid')).rejects.toMatchObject({ code: 'bad_token' });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('الحصة اليومية لكل حساب (D1 حقيقي)', () => {
  it('تُعدّ وتُرفض عند التجاوز وتُعزل بين الحسابات', async () => {
    const env = authEnv({ WEB_DAILY_LIMIT: '3' });
    for (let i = 0; i < 3; i++) await consumeQuota(env, 'u1', 'web');
    await expect(consumeQuota(env, 'u1', 'web')).rejects.toMatchObject({ status: 429, code: 'daily_quota' });
    await expect(consumeQuota(env, 'u2', 'web')).resolves.toBeUndefined();
    expect((await usageToday(env, 'u1')).web).toEqual({ used: 4, limit: 3 });
    expect((await usageToday(env, 'u2')).ai.used).toBe(0);
  });
});

describe('حدود IP والسقف اليومي العام', () => {
  const r = (ip: string) => req('/x', { headers: { 'CF-Connecting-IP': ip } });
  it('D1: يرفض بعد الحد ويعزل بين العناوين', async () => {
    const env = authEnv();
    for (let i = 0; i < 3; i++) await rateLimit(env, r('1.1.1.1'), 'web', 3, 3600);
    await expect(rateLimit(env, r('1.1.1.1'), 'web', 3, 3600)).rejects.toMatchObject({ status: 429 });
    await expect(rateLimit(env, r('2.2.2.2'), 'web', 3, 3600)).resolves.toBeUndefined();
  });
  it('KV: يعمل بدون D1', async () => {
    const env = baseEnv({ CACHE: makeKV() });
    await rateLimit(env, r('3.3.3.3'), 'k', 1, 60);
    await expect(rateLimit(env, r('3.3.3.3'), 'k', 1, 60)).rejects.toMatchObject({ status: 429 });
  });
  it('الذاكرة: بديل أخير بلا D1 ولا KV', async () => {
    const env = baseEnv();
    await rateLimit(env, r('4.4.4.4'), 'm', 1, 60);
    await expect(rateLimit(env, r('4.4.4.4'), 'm', 1, 60)).rejects.toMatchObject({ status: 429 });
  });
  it('جدول rate_limits غير منشأ لا يكسر الطلب (يسقط للبديل)', async () => {
    const env = authEnv();
    env.DB.raw.exec('DROP TABLE rate_limits');
    await expect(rateLimit(env, r('5.5.5.5'), 'x', 5, 60)).resolves.toBeUndefined();
  });
  it('السقف العام اليومي يوقف الخدمة لجميع المستخدمين', async () => {
    const env = authEnv({ WEB_GLOBAL_DAILY_CAP: '2' });
    await globalCap(env, 'web'); await globalCap(env, 'web');
    await expect(globalCap(env, 'web')).rejects.toMatchObject({ status: 503, code: 'capacity' });
    await expect(globalCap(env, 'translate')).resolves.toBeUndefined(); // سقف مستقل لكل خدمة
  });
});

it('SECRET طويل بما يكفي', () => expect(SECRET.length).toBeGreaterThanOrEqual(32));
void makeD1;
