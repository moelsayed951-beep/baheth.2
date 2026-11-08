import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geminiChain, runAi } from '../functions/_lib/ai';
import { _resetLimitsForTests } from '../functions/_lib/limits';
import { onRequestPost as aiHandler } from '../functions/api/proxy/ai';
import { onRequestGet as translateHandler } from '../functions/api/proxy/translate';
import { baseEnv, makeKV, req } from './helpers/env';

const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
const gem = (text: string) => J({ candidates: [{ content: { parts: [{ text }] } }] });
const turns = [{ role: 'user' as const, content: 'لخّص' }];
let calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];

type Handler = (model: string) => Response | Promise<Response>;
function stubGemini(byModel: Record<string, Handler>, extra: Record<string, () => Response> = {}) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : {}, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    const m = /models\/([^:]+):generateContent/.exec(url);
    if (m) { const h = byModel[m[1]]; if (!h) throw new Error(`unexpected model ${m[1]}`); return h(m[1]); }
    const hit = Object.entries(extra).find(([k]) => url.includes(k));
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    return hit[1]();
  }));
}
const timeoutErr = () => { throw new DOMException('timed out', 'TimeoutError'); };

beforeEach(() => { calls = []; _resetLimitsForTests(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('سلسلة نماذج Gemini', () => {
  it('الافتراضي: 2.5-flash ثم 2.5-flash-lite، ولا يتضمن 1.5 المتوقف رسمياً', () => {
    expect(geminiChain(baseEnv())).toEqual(['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
    expect(geminiChain(baseEnv()).join()).not.toContain('1.5');
  });
  it('تخصيص من المتغيرات مع إزالة التكرار', () => {
    expect(geminiChain(baseEnv({ GEMINI_MODEL: 'gemini-3-flash', GEMINI_FALLBACK_MODELS: 'gemini-2.5-flash, gemini-3-flash' }))).toEqual(['gemini-3-flash', 'gemini-2.5-flash']);
  });

  it('انتهاء مهلة النموذج الأول ← يجرّب الثاني ويرجع اسمه', async () => {
    stubGemini({ 'gemini-2.5-flash': timeoutErr, 'gemini-2.5-flash-lite': () => gem('ملخص ناجح') });
    const r = await runAi('gemini', baseEnv(), turns, undefined, 'key-12345678');
    expect(r).toEqual({ text: 'ملخص ناجح', model: 'gemini-2.5-flash-lite' });
    expect(calls).toHaveLength(2);
  });
  it('نموذج غير موجود (404) / ازدحام (429) / خطأ خادم (500) ← ينتقل للتالي', async () => {
    for (const status of [404, 429, 500]) {
      calls = [];
      stubGemini({ 'gemini-2.5-flash': () => new Response('x', { status }), 'gemini-2.5-flash-lite': () => gem('تمام') });
      expect((await runAi('gemini', baseEnv(), turns, undefined, 'key-12345678')).model).toBe('gemini-2.5-flash-lite');
      vi.unstubAllGlobals();
    }
  });
  it('مفتاح مرفوض (401/403): يتوقف فوراً بلا تجربة نماذج أخرى', async () => {
    stubGemini({ 'gemini-2.5-flash': () => new Response('x', { status: 403 }), 'gemini-2.5-flash-lite': () => gem('لا') });
    await expect(runAi('gemini', baseEnv(), turns, undefined, 'bad-key-1234')).rejects.toMatchObject({ code: 'upstream_auth' });
    expect(calls).toHaveLength(1);
  });
  it('محتوى محجوب: يتوقف فوراً', async () => {
    stubGemini({ 'gemini-2.5-flash': () => J({ promptFeedback: { blockReason: 'SAFETY' } }), 'gemini-2.5-flash-lite': () => gem('لا') });
    await expect(runAi('gemini', baseEnv(), turns, undefined, 'key-12345678')).rejects.toMatchObject({ code: 'blocked' });
    expect(calls).toHaveLength(1);
  });
  it('فشل الجميع: رسالة واضحة بأسماء النماذج وأسبابها (504 لو كلها مهلات)', async () => {
    stubGemini({ 'gemini-2.5-flash': () => new Response('x', { status: 500 }), 'gemini-2.5-flash-lite': () => new Response('x', { status: 429 }) });
    const e1 = await runAi('gemini', baseEnv(), turns, undefined, 'key-12345678').catch((e) => e);
    expect(e1).toMatchObject({ status: 502, code: 'ai_unavailable' });
    expect(e1.message).toContain('gemini-2.5-flash');
    expect(e1.message).toContain('gemini-2.5-flash-lite');
    expect(e1.message).toContain('اختر مزوّداً آخر');
    vi.unstubAllGlobals();
    stubGemini({ 'gemini-2.5-flash': timeoutErr, 'gemini-2.5-flash-lite': timeoutErr });
    expect(await runAi('gemini', baseEnv(), turns, undefined, 'key-12345678').catch((e) => e)).toMatchObject({ status: 504, code: 'ai_unavailable' });
  });
  it('مهلة المحاولة 30 ثانية، والمتبقي من الإجمالي 55 ثانية للمحاولة التالية', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    stubGemini({ 'gemini-2.5-flash': timeoutErr, 'gemini-2.5-flash-lite': () => gem('ok') });
    await runAi('gemini', baseEnv(), turns, undefined, 'key-12345678');
    const ms = spy.mock.calls.map((c) => c[0]);
    expect(ms[0]).toBe(30_000);
    expect(ms[1]).toBeLessThanOrEqual(30_000);
    expect(ms[1]).toBeGreaterThan(20_000);
  });
  it('التفكير يُعطَّل لعائلة 2.5 فقط في التلخيص، ومخرجات البحث أطول بلا تعطيل', async () => {
    stubGemini({ 'gemini-2.5-flash': () => gem('a'), 'gemini-3-flash': () => gem('b') });
    await runAi('gemini', baseEnv(), turns, undefined, 'key-12345678');
    expect((calls[0].body.generationConfig as Record<string, unknown>).thinkingConfig).toEqual({ thinkingBudget: 0 });
    await runAi('gemini', baseEnv({ GEMINI_MODEL: 'gemini-3-flash' }), turns, undefined, 'key-12345678');
    expect((calls[1].body.generationConfig as Record<string, unknown>).thinkingConfig).toBeUndefined();
    await runAi('gemini', baseEnv(), turns, undefined, 'key-12345678', { task: 'plan', refs: [] });
    const g = calls[2].body.generationConfig as Record<string, unknown>;
    expect(g.thinkingConfig).toBeUndefined();
    expect(g.maxOutputTokens).toBe(4096);
  });
  it('المفتاح في الترويسة لا في الرابط', async () => {
    stubGemini({ 'gemini-2.5-flash': () => gem('ok') });
    await runAi('gemini', baseEnv(), turns, undefined, 'secret-gem-key');
    expect(calls[0].url).not.toContain('secret-gem-key');
    expect(calls[0].headers['x-goog-api-key']).toBe('secret-gem-key');
  });
});

describe('تقليم النص المرسل', () => {
  const post = (b: unknown) => aiHandler({ request: req('/api/proxy/ai', { method: 'POST', body: JSON.stringify(b), headers: { 'Content-Type': 'application/json', 'X-User-Key': 'key-12345678' } }), env: baseEnv() });
  it('الملخص الطويل يُقلَّم عند حدّ كلمة مع إشعار الاقتطاع (≤ 6000 حرف)', async () => {
    stubGemini({ 'gemini-2.5-flash': () => gem('ok') });
    const long = 'كلمة '.repeat(5000); // 25000 حرف
    const r = await post({ provider: 'gemini', messages: turns, doc: { title: 'ت', text: long } });
    expect(r.status).toBe(200);
    const sys = (calls[0].body.systemInstruction as { parts: { text: string }[] }).parts[0].text;
    expect(sys).toContain('[اقتُطع النص هنا لطوله]');
    expect(sys.length).toBeLessThan(7500);
    expect(sys).not.toContain('كلمة '.repeat(1300));
  });
  it('النص القصير يمر كاملاً بلا إشعار', async () => {
    stubGemini({ 'gemini-2.5-flash': () => gem('ok') });
    await post({ provider: 'gemini', messages: turns, doc: { title: 'ت', text: 'نص قصير عن التعلم' } });
    const sys = (calls[0].body.systemInstruction as { parts: { text: string }[] }).parts[0].text;
    expect(sys).toContain('نص قصير عن التعلم');
    expect(sys).not.toContain('اقتُطع');
  });
  it('الرد يتضمن النموذج الذي أجاب فعلاً عند الاحتياط', async () => {
    stubGemini({ 'gemini-2.5-flash': timeoutErr, 'gemini-2.5-flash-lite': () => gem('ok') });
    const r = await post({ provider: 'gemini', messages: turns });
    expect((await r.json() as { model: string }).model).toBe('gemini-2.5-flash-lite');
  });
});

describe('الترجمة الاحتياطية بـ Gemini على الخادم', () => {
  const tr = (env: ReturnType<typeof baseEnv>, q = 'تقدير الذات لدى الصم', headers: Record<string, string> = {}) =>
    translateHandler({ request: req(`/api/proxy/translate?q=${encodeURIComponent(q)}`, { headers }), env });
  const mm = () => J({ responseStatus: 200, responseData: { translatedText: 'self esteem deaf (fallback-mt)' } });

  it('بمفتاح المستخدم: Gemini أولاً ولا يمس MyMemory', async () => {
    stubGemini({ 'gemini-2.5-flash': () => gem('"Self-esteem among deaf students"\nشرح') }, { mymemory: mm });
    const r = await tr(baseEnv(), undefined, { 'X-User-Key': 'user-gem-key-1' });
    expect(await r.json()).toMatchObject({ text: 'Self-esteem among deaf students' });
    expect(calls.some((c) => c.url.includes('mymemory'))).toBe(false);
    expect(calls[0].headers['x-goog-api-key']).toBe('user-gem-key-1');
    expect((calls[0].body.generationConfig as { maxOutputTokens: number }).maxOutputTokens).toBe(60);
  });
  it('بمفتاح المنصة (GEMINI_API_KEY) يُحسب في السقف العام، وبعد السقف ينتقل لـ MyMemory بهدوء', async () => {
    stubGemini({ 'gemini-2.5-flash': () => gem('platform translated') }, { mymemory: mm });
    const env = baseEnv({ GEMINI_API_KEY: 'server-gem-key', AI_GLOBAL_DAILY_CAP: '1' });
    expect((await (await tr(env, 'مصطلح أول')).json() as { text: string }).text).toBe('platform translated');
    expect((await (await tr(env, 'مصطلح ثان')).json() as { text: string }).text).toBe('self esteem deaf (fallback-mt)');
  });
  it('فشل Gemini (500) أو ترجمة عربية مرتدة ← MyMemory', async () => {
    stubGemini({ 'gemini-2.5-flash': () => new Response('x', { status: 500 }), 'gemini-2.5-flash-lite': () => new Response('x', { status: 500 }) }, { mymemory: mm });
    expect((await (await tr(baseEnv(), 'س1', { 'X-User-Key': 'user-gem-key-1' })).json() as { text: string }).text).toContain('fallback-mt');
    vi.unstubAllGlobals();
    stubGemini({ 'gemini-2.5-flash': () => gem('ترجمة عربية خاطئة') }, { mymemory: mm });
    expect((await (await tr(baseEnv(), 'س2', { 'X-User-Key': 'user-gem-key-1' })).json() as { text: string }).text).toContain('fallback-mt');
  });
  it('بلا أي مفتاح Gemini: MyMemory مباشرة. وكاش 24 ساعة يمنع التكرار', async () => {
    stubGemini({}, { mymemory: mm });
    const env = baseEnv({ CACHE: makeKV() });
    await tr(env, 'تعلم'); await tr(env, 'تعلم');
    expect(calls).toHaveLength(1);
  });
  it('فشل كل شيء: 502 واضح', async () => {
    stubGemini({}, { mymemory: () => new Response('x', { status: 500 }) });
    expect((await tr(baseEnv(), 'فشل')).status).toBe(502);
  });
  it('مفتاح بصيغة مشبوهة مرفوض (400)', async () => {
    expect((await tr(baseEnv(), 'تعلم', { 'X-User-Key': 'bad key!' })).status).toBe(400);
  });
});
