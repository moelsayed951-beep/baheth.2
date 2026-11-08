import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BILINGUAL_TERMS } from '@/data/dictionary';
import { SourceStatus } from '@/components/Search/SourceStatus';
import { resolveEnglishQuery } from '@/services/translate';
import { classifyFailure } from '@/services/sourceIssues';
import { SourceSkipped } from '@/services/errors';
import { searchCore } from '@/services/sources/core';
import { _resetParkedForTests, searchProxied } from '@/services/sources/proxied';
import { searchSemanticScholar } from '@/services/sources/semanticscholar';
import { mergeReports } from '@/services/aggregator';
import { askAi } from '@/services/aiService';
import { ProxyError } from '@/utils/proxy';
import { expandQuery } from '@/utils/queryExpander';
import { getKey, isValidKey, setKey } from '@/utils/userKeys';
import type { AggregateResult, SourceReport } from '@/types';
import { runSource } from '../functions/_lib/sources';
import { onRequestGet as sourceHandler } from '../functions/api/proxy/source';
import { _resetLimitsForTests } from '../functions/_lib/limits';
import { baseEnv, makeKV, req } from './helpers/env';
import { filters } from './helpers/paper';

const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
let seen: { url: string; headers: Record<string, string>; body?: string }[] = [];
const stub = (fn: (url: string) => Response) =>
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()), body: typeof init?.body === 'string' ? init.body : undefined });
    return fn(url);
  }));

beforeEach(() => { seen = []; _resetParkedForTests(); _resetLimitsForTests(); setKey('core', ''); setKey('s2', ''); setKey('gemini', ''); });
afterEach(() => vi.unstubAllGlobals());

describe('قاموس المصطلحات التربوية الموسّع', () => {
  const en = (q: string) => expandQuery(q);
  it('حجم القاموس كبير ويغطي ما طُلب (أصول التربية، المناهج، علم النفس التربوي، الإعاقة السمعية...)', () => {
    expect(Object.keys(BILINGUAL_TERMS).length).toBeGreaterThanOrEqual(500);
    expect(en('أصول التربية').english).toBe('Foundations of Education');
    expect(en('المناهج').english).toBe('Curriculum');
    expect(en('علم النفس التربوي').english).toBe('Educational Psychology');
    expect(en('الإعاقة السمعية').english).toBe('Hearing Impairment');
    expect(en('صعوبات التعلم').english).toBe('Learning Disabilities');
    expect(en('المناهج وطرق التدريس').english).toBe('Curriculum and Instruction');
  });
  it('يتجاهل التشكيل والهمزات والتاء المربوطة والـ«ال» وحروف الجر الملتصقة', () => {
    for (const v of ['صعوبات التعلّم', 'صعوبات التعلم', 'وصعوبات التعلم', 'بصعوبات التعلم', 'صعوبات تعلم', 'صَعُوبَات التَّعَلُّم']) {
      expect(en(v).english, v).toBe('Learning Disabilities');
    }
    expect(en('الاعاقه السمعيه').english).toBe('Hearing Impairment');
    expect(en('للصم').english).toBe('Deaf Students');
    expect(en('الإدارة المدرسية').english).toBe(en('الاداره المدرسيه').english);
  });
  it('الكلمات العامة (أثر/فاعلية/دور...) لا تلوّث الترجمة، والاستعلام الكامل يُعدّ مكتملاً', () => {
    const r = en('أثر استخدام التعلم النشط في التحصيل الدراسي لدى طلاب الجامعة');
    expect(r.english).toBe('Active Learning Academic Achievement University Students'); // بترتيب الاستعلام الأصلي
    expect(r.complete).toBe(true);
  });
  it('العبارة المركبة تسبق مفرداتها', () => {
    expect(en('ذوي الاحتياجات الخاصة').english).toBe('Students with Special Needs');
    expect(en('اضطراب طيف التوحد').english).toBe('Autism Spectrum Disorder');
  });
  it('استعلام جزئي: يبقى ما عرفه القاموس ويُعلَّم أنه غير مكتمل مع الكلمات المجهولة', () => {
    const r = en('صعوبات التعلم والخجل المفرط');
    expect(r.english).toContain('Learning Disabilities');
    expect(r.complete).toBe(false);
    expect(r.unmatched).toEqual(expect.arrayContaining(['خجل']));
  });
  it('رموز لاتينية داخل استعلام عربي تُحفظ، والإنجليزي الصرف يمر كما هو', () => {
    expect(en('تعليم ADHD').english).toContain('ADHD');
    expect(en('machine learning').english).toBe('machine learning');
  });
  it('لا قاموس نهائياً لكلمة مجهولة: english فارغ', () => {
    expect(en('خجل').english).toBe('');
  });
});

describe('الترجمة الاحتياطية من العميل', () => {
  it('القاموس يغطي: لا طلب شبكة إطلاقاً', async () => {
    stub(() => { throw new Error('should not call'); });
    expect(await resolveEnglishQuery('صعوبات التعلم')).toBe('Learning Disabilities');
    expect(seen).toHaveLength(0);
  });
  it('استعلام غير مغطى: يطلب الترجمة من الخادم، مرة واحدة فقط لنفس الاستعلام', async () => {
    stub(() => J({ text: 'shyness in adolescents' }));
    expect(await resolveEnglishQuery('الخجل لدى المراهقين الموهوبين الجدد')).toBe('shyness in adolescents');
    await resolveEnglishQuery('الخجل لدى المراهقين الموهوبين الجدد');
    expect(seen).toHaveLength(1);
  });
  it('فشل الترجمة: يعود لما عرفه القاموس جزئياً بدل إيقاف البحث', async () => {
    stub(() => J({ error: 'x', code: 'translate_failed' }, 502));
    expect(await resolveEnglishQuery('الذكاء الاصطناعي والرهاب الاجتماعي المزمن')).toContain('Artificial Intelligence');
  });
  it('يرسل مفتاح Gemini الخاص بالمستخدم في الترويسة X-User-Key', async () => {
    setKey('gemini', 'my-gemini-key-123');
    stub(() => J({ text: 'translated by gemini' }));
    await resolveEnglishQuery('كلمة غريبة جداً لا يعرفها قاموس');
    expect(seen[0].headers['x-user-key']).toBe('my-gemini-key-123');
  });
});

describe('مفاتيح Semantic Scholar وCORE: التخزين والإرسال من العميل', () => {
  it('تُحفظ وتُقرأ ومنفصلة عن بقية المفاتيح، وتُتحقق صيغتها', () => {
    setKey('s2', 's2-key-abcdef12'); setKey('core', 'core-key-abcdef12');
    expect(getKey('s2')).toBe('s2-key-abcdef12');
    expect(getKey('core')).toBe('core-key-abcdef12');
    expect(getKey('gemini')).toBeUndefined();
    expect(isValidKey('short')).toBe(false);
    expect(isValidKey('has space in it 123')).toBe(false);
  });
  it('Semantic Scholar: المفتاح يُرسل في X-User-S2-Key إلى الوسيط (لا إلى api.semanticscholar.org مباشرة)', async () => {
    setKey('s2', 's2-key-abcdef12');
    stub(() => J({ results: [] }));
    await searchSemanticScholar(filters({ query: 'التعلم النشط', englishQuery: 'active learning', yearStart: 2018, yearEnd: 2022 }));
    expect(seen[0].url.startsWith('/api/proxy/source?src=semanticscholar')).toBe(true);
    expect(seen[0].url).toContain('ys=2018&ye=2022');
    expect(seen[0].headers['x-user-s2-key']).toBe('s2-key-abcdef12');
    expect(seen[0].url).not.toContain('s2-key-abcdef12');
    expect(seen[0].url).not.toContain('api.semanticscholar.org');
  });
  it('بلا مفتاح: لا ترويسة، ويستخدم الوسيط مفتاح المنصة', async () => {
    stub(() => J({ results: [] }));
    await searchSemanticScholar(filters({ query: 'x', englishQuery: 'active learning' }));
    expect(seen[0].headers['x-user-s2-key']).toBeUndefined();
  });
  it('CORE: المفتاح يُرسل في X-User-Core-Key', async () => {
    setKey('core', 'core-key-abcdef12');
    stub(() => J({ results: [] }));
    await searchCore(filters({ query: 'التربية' }));
    expect(seen[0].headers['x-user-core-key']).toBe('core-key-abcdef12');
    expect(seen[0].headers['x-user-s2-key']).toBeUndefined(); // لا تتسرب المفاتيح بين المصادر
  });
  it('الواجهة تحتوي حقلي المفتاحين في صفحة «مفاتيحي»', () => {
    const page = readFileSync('src/pages/SettingsPage.tsx', 'utf-8');
    expect(page).toContain("id: 's2'");
    expect(page).toContain("id: 'core'");
    expect(page).toContain('Semantic Scholar');
  });
});

describe('الوسيط: مفتاح المستخدم ثم مفتاح المنصة (CORE وSemantic Scholar)', () => {
  const ask = (env: ReturnType<typeof baseEnv>, src: string, headers: Record<string, string> = {}, extra = '') =>
    sourceHandler({ request: req(`/api/proxy/source?src=${src}&q=education${extra}`, { headers }), env });
  const coreOk = () => J({ results: [{ id: 1, title: 'C1', yearPublished: 2020, documentType: 'thesis', authors: [] }] });
  const s2Ok = () => J({ data: [
    { paperId: 'p1', title: 'Deep learning in education', year: 2021, authors: [{ name: 'A One' }], citationCount: 42, isOpenAccess: true, openAccessPdf: { url: 'https://pdf.example/p1.pdf' }, externalIds: { DOI: '10.1/s2' }, venue: 'J Ed Tech', publicationTypes: ['JournalArticle'] },
    { paperId: 'p2', title: 'A Handbook', year: 2019, publicationTypes: ['Book'], citationCount: 3 },
    { paperId: 'p3' }
  ] });

  it('CORE: مفتاح المستخدم له الأولوية على مفتاح المنصة', async () => {
    stub(coreOk);
    await ask(baseEnv({ CORE_API_KEY: 'platform-core-key' }), 'core', { 'X-User-Core-Key': 'user-core-key-1' });
    expect(seen[0].headers.authorization).toBe('Bearer user-core-key-1');
  });
  it('CORE: بلا مفتاح مستخدم يستخدم مفتاح المنصة، وبلا الاثنين 503 not_configured', async () => {
    stub(coreOk);
    await ask(baseEnv({ CORE_API_KEY: 'platform-core-key' }), 'core');
    expect(seen[0].headers.authorization).toBe('Bearer platform-core-key');
    const r = await ask(baseEnv(), 'core');
    expect(r.status).toBe(503);
    expect((await r.json() as { code: string }).code).toBe('not_configured');
  });
  it('Semantic Scholar: ترتيب الأولوية (مستخدم ← منصة ← بلا مفتاح) والمفتاح في الترويسة لا الرابط', async () => {
    stub(s2Ok);
    await ask(baseEnv({ S2_API_KEY: 'platform-s2-key' }), 'semanticscholar', { 'X-User-S2-Key': 'user-s2-key-1' });
    expect(seen[0].headers['x-api-key']).toBe('user-s2-key-1');
    await ask(baseEnv({ S2_API_KEY: 'platform-s2-key' }), 'semanticscholar', {}, '&page=1');
    expect(seen[1].headers['x-api-key']).toBe('platform-s2-key');
    await ask(baseEnv(), 'semanticscholar', {}, '&page=2');
    expect(seen[2].headers['x-api-key']).toBeUndefined();
    for (const s of seen) { expect(s.url).not.toContain('user-s2-key-1'); expect(s.url).not.toContain('platform-s2-key'); }
  });
  it('Semantic Scholar: تحويل النتائج (DOI، PDF، استشهادات، نوع كتاب) وتصفية السنوات', async () => {
    stub(s2Ok);
    const r = await runSource('semanticscholar', baseEnv(), 'education', 1, { yearStart: 2018, yearEnd: 2022 });
    expect(r).toHaveLength(2); // p3 بلا عنوان يُستبعد
    expect(r[0]).toMatchObject({ id: 's2-p1', url: 'https://doi.org/10.1/s2', doi: '10.1/s2', citationCount: 42, openAccess: true, pdfUrl: 'https://pdf.example/p1.pdf', venue: 'J Ed Tech', year: '2021' });
    expect(r[1].type).toBe('book');
    expect(seen[0].url).toContain('offset=20');
    expect(decodeURIComponent(seen[0].url)).toContain('year=2018-2022');
  });
  it('رموز مفاتيح بصيغة مشبوهة تُرفض (400)، ومفتاح المستخدم لا يُخزَّن في الكاش ولا يظهر في الرد', async () => {
    stub(s2Ok);
    expect((await ask(baseEnv(), 'semanticscholar', { 'X-User-S2-Key': 'bad key!!' })).status).toBe(400);
    const kv = makeKV();
    const r = await ask(baseEnv({ CACHE: kv }), 'semanticscholar', { 'X-User-S2-Key': 'user-s2-key-1' });
    expect(await r.text()).not.toContain('user-s2-key-1');
    expect(JSON.stringify([...kv.store.entries()])).not.toContain('user-s2-key-1');
    // الطلب التالي بلا مفتاح يستفيد من الكاش (النتائج عامة)
    const again = await (await ask(baseEnv({ CACHE: kv }), 'semanticscholar')).json() as { cached: boolean };
    expect(again.cached).toBe(true);
  });
  it('مفتاح CORE لا يُقبل لمصدر آخر (لا تسريب بين المصادر)', async () => {
    stub(() => J({ results: [] }));
    await ask(baseEnv(), 'doaj', { 'X-User-Core-Key': 'user-core-key-1', 'X-User-S2-Key': 'user-s2-key-1' });
    expect(seen[0].url).toContain('doaj.org');
    expect(JSON.stringify(seen[0].headers)).not.toContain('user-core-key-1');
    expect(JSON.stringify(seen[0].headers)).not.toContain('user-s2-key-1');
  });
  it('Zenodo: يعرّف التطبيق ويستخدم رمز الوصول الاختياري، ورفض 403 يُصنَّف upstream_auth', async () => {
    stub(() => J({ hits: { hits: [] } }));
    await runSource('zenodo', baseEnv({ ZENODO_ACCESS_TOKEN: 'zen-token-123' }), 'x', 0);
    expect(seen[0].headers['user-agent']).toContain('BahethResearchPortal');
    expect(seen[0].headers.authorization).toBe('Bearer zen-token-123');
    vi.unstubAllGlobals();
    stub(() => new Response('forbidden', { status: 403 }));
    await expect(runSource('zenodo', baseEnv(), 'x', 0)).rejects.toMatchObject({ code: 'upstream_auth' });
  });
});

describe('تصنيف أخطاء المصادر', () => {
  const pe = (status: number, code: string, msg = 'm') => new ProxyError(status, code, msg);
  it('CORE بلا مفتاح ← يحتاج مفتاحاً مع رابط صفحة المفاتيح (وليس خطأ أحمر)', () => {
    const c = classifyFailure('core', pe(503, 'not_configured'));
    expect(c.status).toBe('skipped');
    expect(c.issue).toMatchObject({ kind: 'needs_key', action: { to: '/settings' } });
    expect(c.message).toContain('CORE_API_KEY');
    expect(c.message).toContain('مفاتيحي');
  });
  it('BASE ← تسجيل IP', () => {
    const c = classifyFailure('base', pe(502, 'base_ip_not_registered'));
    expect(c).toMatchObject({ status: 'skipped', issue: { kind: 'needs_ip' } });
    expect(c.message).toContain('تسجيل IP لدى BASE');
  });
  it('Zenodo 403 ← يتطلب تسجيل دخول', () => {
    const c = classifyFailure('zenodo', pe(502, 'upstream_auth'));
    expect(c).toMatchObject({ status: 'skipped', issue: { kind: 'needs_login' } });
    expect(c.message).toContain('يتطلب تسجيل دخول');
  });
  it('Semantic Scholar 429 ← مفتاح، وبقية المصادر 429 ← ازدحام مؤقت', () => {
    expect(classifyFailure('semanticscholar', pe(429, 'quota')).issue.kind).toBe('needs_key');
    expect(classifyFailure('doaj', pe(429, 'quota')).issue.kind).toBe('quota');
  });
  it('الفشل الحقيقي يبقى خطأ: مهلة/شبكة/خطأ خادم', () => {
    expect(classifyFailure('pubmed', pe(0, 'timeout'))).toMatchObject({ status: 'error', issue: { kind: 'network' } });
    expect(classifyFailure('pubmed', pe(502, 'upstream_error', 'تعذر الاتصال بـ PubMed (HTTP 500)')).status).toBe('error');
    expect(classifyFailure('pubmed', new Error('boom'))).toMatchObject({ status: 'error', message: 'boom' });
  });
  it('تخطي بلا ترجمة، وتسجيل دخول مطلوب للمكتبات العربية', () => {
    expect(classifyFailure('eric', new SourceSkipped('x', 'no_translation')).issue.kind).toBe('no_translation');
    expect(classifyFailure('web_arabic_db', pe(401, 'login_required')).issue.kind).toBe('needs_login');
  });
});

describe('إيقاف المصادر المعطّلة بهدوء خلال الجلسة (لا طلبات متكررة)', () => {
  it('BASE: أول مرة يطلب، وبعدها يتخطى دون أي طلب شبكة', async () => {
    stub(() => J({ error: 'BASE يرفض', code: 'base_ip_not_registered' }, 502));
    await expect(searchProxied('base', filters({ query: 'تربية' }))).rejects.toMatchObject({ kind: 'needs_ip' });
    await expect(searchProxied('base', filters({ query: 'تربية', page: 1 }))).rejects.toMatchObject({ kind: 'needs_ip' });
    expect(seen).toHaveLength(1);
  });
  it('Zenodo 403: يُتخطى بعد أول رفض', async () => {
    stub(() => J({ error: 'رفض', code: 'upstream_auth' }, 502));
    await expect(searchProxied('zenodo', filters({ query: 'تربية' }))).rejects.toMatchObject({ kind: 'needs_login' });
    await searchProxied('zenodo', filters({ query: 'تربية', page: 1 })).catch(() => undefined);
    expect(seen).toHaveLength(1);
  });
  it('CORE بلا مفتاح: يُتخطى، وعند إضافة المستخدم مفتاحه يعيد المحاولة تلقائياً ويرسله', async () => {
    stub(() => J({ error: 'يتطلب مفتاحاً', code: 'not_configured' }, 503));
    await expect(searchCore(filters({ query: 'تربية' }))).rejects.toMatchObject({ kind: 'needs_key' });
    await searchCore(filters({ query: 'تربية', page: 1 })).catch(() => undefined);
    expect(seen).toHaveLength(1);
    setKey('core', 'core-key-abcdef12');
    vi.unstubAllGlobals(); seen = [];
    stub(() => J({ results: [] }));
    await expect(searchCore(filters({ query: 'تربية' }))).resolves.toEqual([]);
    expect(seen[0].headers['x-user-core-key']).toBe('core-key-abcdef12');
  });
  it('لو رُفض مفتاح المستخدم نفسه: رسالة تخبره بذلك (لا «أضف مفتاحاً») ولا يُوقف المصدر', async () => {
    setKey('core', 'core-key-abcdef12');
    stub(() => J({ error: 'x', code: 'upstream_auth' }, 502));
    const e = await searchCore(filters({ query: 'تربية' })).catch((x) => x);
    expect(e).toBeInstanceOf(SourceSkipped);
    expect(e.message).toContain('رفض مفتاحك');
    await searchCore(filters({ query: 'تربية', page: 1 })).catch(() => undefined);
    expect(seen).toHaveLength(2);
  });
  it('خطأ شبكي عابر لا يُوقف المصدر', async () => {
    stub(() => J({ error: 'x', code: 'upstream_error' }, 502));
    await searchProxied('doaj', filters({ query: 'x' })).catch(() => undefined);
    await searchProxied('doaj', filters({ query: 'x', page: 1 })).catch(() => undefined);
    expect(seen).toHaveLength(2);
  });
});

describe('عرض حالة المصادر في الواجهة', () => {
  const reports: SourceReport[] = [
    { id: 'openalex', label: 'OpenAlex', status: 'ok', count: 25 },
    { id: 'pubmed', label: 'PubMed', status: 'error', count: 0, message: 'تعذر الاتصال مؤقتاً', issue: { kind: 'network' } },
    { id: 'core', label: 'CORE', status: 'skipped', count: 0, message: 'يتطلب مفتاح CORE: أضف مفتاحك من «مفاتيحي»', issue: { kind: 'needs_key', action: { label: 'أضف مفتاحك', to: '/settings' } } },
    { id: 'base', label: 'BASE', status: 'skipped', count: 0, message: 'يتطلب تسجيل IP لدى BASE (يُتجاهل بهدوء)', issue: { kind: 'needs_ip' } },
    { id: 'zenodo', label: 'Zenodo', status: 'skipped', count: 0, message: 'يتطلب تسجيل دخول (رمز وصول Zenodo عبر ZENODO_ACCESS_TOKEN)', issue: { kind: 'needs_login' } }
  ];
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(SourceStatus, { reports })));

  it('غير المتاح يُطوى داخل قسم هادئ <details>، لا شارات حمراء', () => {
    expect(html).toContain('<details');
    expect(html).toContain('3 مصادر غير متاحة حالياً');
    expect(html).not.toMatch(/bg-red-/);
    expect(html).not.toMatch(/text-red-/);
  });
  it('الرسائل المطلوبة لـ CORE وBASE وZenodo ظاهرة بنصها', () => {
    expect(html).toContain('يتطلب مفتاح CORE');
    expect(html).toContain('يتطلب تسجيل IP لدى BASE');
    expect(html).toContain('يتطلب تسجيل دخول');
  });
  it('رابط إصلاح لصفحة المفاتيح لما يحتاج مفتاحاً فقط', () => {
    expect(html.match(/href="\/settings"/g)).toHaveLength(1);
    expect(html).toContain('أضف مفتاحك');
  });
  it('الناجح أخضر والفشل الحقيقي كهرماني صغير (ليس أحمر)', () => {
    expect(html).toContain('OpenAlex (25)');
    expect(html).toMatch(/title="تعذر الاتصال مؤقتاً" class="[^"]*bg-amber-50/);
  });
  it('بلا مصادر غير متاحة: لا يظهر قسم التفاصيل', () => {
    const h = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(SourceStatus, { reports: reports.slice(0, 2) })));
    expect(h).not.toContain('<details');
  });
  it('دمج تقارير الصفحات: ينجح المصدر إن نجح في أي صفحة ويحتفظ بسبب العطل وإلا', () => {
    const page = (r: SourceReport): AggregateResult => ({ papers: [], reports: [r] });
    const bad: SourceReport = { id: 'core', label: 'CORE', status: 'skipped', count: 0, message: 'm', issue: { kind: 'needs_key' } };
    expect(mergeReports([page(bad), page(bad)])[0]).toMatchObject({ status: 'skipped', issue: { kind: 'needs_key' } });
    const merged = mergeReports([page(bad), page({ id: 'core', label: 'CORE', status: 'ok', count: 5 })])[0];
    expect(merged.status).toBe('ok'); expect(merged.issue).toBeUndefined();
  });
});

describe('تقليم نص الذكاء الاصطناعي من العميل', () => {
  it('لا يرسل أكثر من 6000 حرف من الملخص', async () => {
    stub(() => J({ provider: 'gemini', model: 'gemini-2.5-flash', text: 'ok' }));
    await askAi('gemini', [{ role: 'user', content: 'لخّص' }], { title: 't', text: 'ك'.repeat(20000) });
    const sent = JSON.parse(seen[0].body ?? '{}') as { doc: { text: string } };
    expect(sent.doc.text.length).toBeLessThanOrEqual(6001);
  });
});
