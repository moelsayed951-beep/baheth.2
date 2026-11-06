import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSource } from '../functions/_lib/sources';
import { onRequestGet as sourceHandler } from '../functions/api/proxy/source';
import { onRequestGet as translateHandler } from '../functions/api/proxy/translate';
import { _resetLimitsForTests } from '../functions/_lib/limits';
import { baseEnv, makeKV, req } from './helpers/env';

const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
let calls: string[] = [];
let headersSeen: Record<string, string>[] = [];

function mockFetch(routes: Record<string, (url: URL) => Response>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(String(input));
    calls.push(u.toString());
    headersSeen.push(Object.fromEntries(new Headers(init?.headers).entries()));
    const hit = Object.entries(routes).find(([k]) => u.toString().includes(k));
    if (!hit) throw new Error(`unexpected fetch ${u}`);
    return hit[1](u);
  }));
}

beforeEach(() => { calls = []; headersSeen = []; _resetLimitsForTests(); });
afterEach(() => vi.unstubAllGlobals());

describe('محوّلات المصادر العالمية (بيانات مزيفة بصيغة الواجهات الحقيقية)', () => {
  it('PubMed: خطوتان + ترقيم الصفحات + بيانات المجلة', async () => {
    mockFetch({
      'esearch.fcgi': () => J({ esearchresult: { idlist: ['1', '2'] } }),
      'esummary.fcgi': () => J({ result: {
        '1': { uid: '1', title: 'Autism <b>therapy</b>.', authors: [{ name: 'Smith J' }], pubdate: '2020 Jan', source: 'J Med', fulljournalname: 'Journal of Medicine', volume: '5', issue: '2', pages: '1-9', articleids: [{ idtype: 'doi', value: '10.1/x' }] },
        '2': { uid: '2' }
      } })
    });
    const r = await runSource('pubmed', baseEnv(), 'autism', 2);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ title: 'Autism therapy.', year: '2020', venue: 'Journal of Medicine', volume: '5', pages: '1-9', doi: '10.1/x', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' });
    expect(calls[0]).toContain('retstart=40');
  });

  it('PubMed: مفتاح NCBI الاختياري يُرسل', async () => {
    mockFetch({ 'esearch.fcgi': () => J({ esearchresult: { idlist: [] } }) });
    await runSource('pubmed', baseEnv({ NCBI_API_KEY: 'KEY123' }), 'x', 0);
    expect(calls[0]).toContain('api_key=KEY123');
  });

  it('DOAJ', async () => {
    mockFetch({ 'doaj.org/api/search/articles': () => J({ results: [
      { id: 'd1', bibjson: { title: 'T <i>one</i>', year: '2019', author: [{ name: 'X Y' }], identifier: [{ type: 'doi', id: '10.2/y' }], link: [{ url: 'https://ex.org/full', type: 'fulltext' }], journal: { title: 'J Ed', volume: '1', number: '2' }, start_page: '3', end_page: '9' } },
      { id: 'd2', bibjson: {} }
    ] }) });
    const r = await runSource('doaj', baseEnv(), 'education', 2);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ title: 'T one', venue: 'J Ed', volume: '1', issue: '2', pages: '3–9', url: 'https://ex.org/full', openAccess: true });
    expect(calls[0]).toContain('page=3');
  });

  it('arXiv (Atom XML)', async () => {
    const xml = `<feed><entry><id>http://arxiv.org/abs/2101.00001v1</id><title>Deep  Learning
 Survey</title><summary>An overview.</summary><published>2021-01-01T00:00:00Z</published><author><name>A One</name></author><author><name>B Two</name></author></entry></feed>`;
    mockFetch({ 'export.arxiv.org': () => new Response(xml) });
    const r = await runSource('arxiv', baseEnv(), 'deep learning', 1);
    expect(r[0]).toMatchObject({ title: 'Deep Learning Survey', year: '2021', url: 'https://arxiv.org/abs/2101.00001v1', pdfUrl: 'https://arxiv.org/pdf/2101.00001v1' });
    expect(r[0].authors).toEqual(['A One', 'B Two']);
    expect(calls[0]).toContain('start=20');
  });

  it('BASE: يتجاهل الروابط غير الآمنة، ويشرح خطأ تسجيل IP', async () => {
    mockFetch({ 'base-search.net': () => J({ response: { docs: [
      { dctitle: 'Thesis A', dclink: 'https://repo.edu.eg/1', dcyear: 2018, dccreator: ['Ali'], dcsource: 'Cairo Univ Repo', dctypenorm: ['thesis'] },
      { dctitle: 'Evil', dclink: 'javascript:alert(1)' },
      { dctitle: 'NoLink' }
    ] } }) });
    const r = await runSource('base', baseEnv(), 'x', 0);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ type: 'thesis', institution: 'Cairo Univ Repo', source: 'BASE' });
    vi.unstubAllGlobals();
    mockFetch({ 'base-search.net': () => new Response('', { status: 403 }) });
    await expect(runSource('base', baseEnv(), 'x', 0)).rejects.toMatchObject({ code: 'base_ip_not_registered' });
  });

  it('Europe PMC / Zenodo / HAL', async () => {
    mockFetch({
      'europepmc': () => J({ resultList: { result: [{ id: '9', source: 'MED', title: 'EP', authorString: 'Doe J, Roe R.', pubYear: '2022', abstractText: 'abs', isOpenAccess: 'Y', doi: '10.3/z', journalInfo: { volume: '7', issue: '1', journal: { title: 'EJ' } }, pageInfo: '5-8' }] } }),
      'zenodo.org': () => J({ hits: { hits: [{ id: 5, links: { self_html: 'https://zenodo.org/records/5' }, metadata: { title: 'Zen Thesis', creators: [{ name: 'Q' }], publication_date: '2017-05-01', resource_type: { type: 'publication', subtype: 'thesis' } } }] } }),
      'archives-ouvertes': () => J({ response: { docs: [{ halId_s: 'hal-1', title_s: ['Thèse'], authFullName_s: ['Dupont'], producedDateY_i: 2015, uri_s: 'https://hal.science/hal-1', docType_s: 'THESE', openAccess_bool: true }] } })
    });
    const e = await runSource('europepmc', baseEnv(), 'x', 0);
    expect(e[0]).toMatchObject({ venue: 'EJ', volume: '7', pages: '5-8', openAccess: true });
    expect(e[0].authors).toEqual(['Doe J', 'Roe R']);
    const z = await runSource('zenodo', baseEnv(), 'x', 2);
    expect(z[0].type).toBe('thesis'); expect(calls.find((c) => c.includes('zenodo'))).toContain('page=3');
    const h = await runSource('hal', baseEnv(), 'x', 2);
    expect(h[0]).toMatchObject({ type: 'thesis', year: '2015' }); expect(calls.find((c) => c.includes('archives-ouvertes'))).toContain('start=40');
  });

  it('CORE: المفتاح على الخادم فقط ويُرسل كترويسة، وبدونه خطأ واضح', async () => {
    await expect(runSource('core', baseEnv(), 'x', 0)).rejects.toMatchObject({ status: 503, code: 'not_configured' });
    mockFetch({ 'api.core.ac.uk': () => J({ results: [{ id: 1, title: 'C1', yearPublished: 2020, documentType: 'thesis', dataProviders: [{ name: 'Univ Repo' }], authors: [{ name: 'A' }] }] }) });
    const r = await runSource('core', baseEnv({ CORE_API_KEY: 'secret-core-key' }), 'x', 1);
    expect(r[0]).toMatchObject({ type: 'thesis', institution: 'Univ Repo' });
    expect(headersSeen[0].authorization).toBe('Bearer secret-core-key');
    expect(calls[0]).toContain('offset=20');
    expect(calls[0]).not.toContain('secret-core-key'); // لا يظهر المفتاح في الرابط
  });

  it('رد 429/403 من المزوّد يتحول لرسالة عربية بلا تسريب', async () => {
    mockFetch({ 'doaj.org': () => new Response('secret upstream body', { status: 429 }) });
    await expect(runSource('doaj', baseEnv(), 'x', 0)).rejects.toMatchObject({ status: 429, code: 'quota' });
  });
});

describe('وسيط /api/proxy/source', () => {
  it('تحقق المدخلات', async () => {
    const env = baseEnv();
    expect((await sourceHandler({ request: req('/api/proxy/source?src=nope&q=a'), env })).status).toBe(400);
    expect((await sourceHandler({ request: req('/api/proxy/source?src=doaj'), env })).status).toBe(400);
    expect((await sourceHandler({ request: req(`/api/proxy/source?src=doaj&q=${'a'.repeat(201)}`), env })).status).toBe(400);
  });

  it('كاش KV: الطلب الثاني لا يصل للمزوّد، والصفحات مستقلة', async () => {
    mockFetch({ 'doaj.org': () => J({ results: [{ id: 'd1', bibjson: { title: 'T', year: '2020', link: [{ url: 'https://e.org/a', type: 'fulltext' }] } }] }) });
    const env = baseEnv({ CACHE: makeKV() });
    const a = await (await sourceHandler({ request: req('/api/proxy/source?src=doaj&q=edu&page=0'), env })).json() as { cached: boolean };
    const b = await (await sourceHandler({ request: req('/api/proxy/source?src=doaj&q=edu&page=0'), env })).json() as { cached: boolean };
    expect(a.cached).toBe(false); expect(b.cached).toBe(true);
    await sourceHandler({ request: req('/api/proxy/source?src=doaj&q=edu&page=1'), env });
    expect(calls).toHaveLength(2);
  });

  it('حد IP: يرفض بعد الحد (على الطلبات غير المخزّنة فقط)', async () => {
    mockFetch({ 'doaj.org': () => J({ results: [] }) });
    const env = baseEnv({ SOURCE_IP_HOURLY: '2' });
    const ask = (q: string) => sourceHandler({ request: req(`/api/proxy/source?src=doaj&q=${q}`, { headers: { 'CF-Connecting-IP': '9.9.9.9' } }), env });
    expect((await ask('a')).status).toBe(200);
    expect((await ask('b')).status).toBe(200);
    expect((await ask('c')).status).toBe(429);
  });

  it('طلب من موقع آخر مرفوض', async () => {
    const r = await sourceHandler({ request: req('/api/proxy/source?src=doaj&q=a', { headers: { Origin: 'https://evil.com' } }), env: baseEnv() });
    expect(r.status).toBe(403);
  });
});

describe('وسيط الترجمة', () => {
  it('ترجمة ناجحة ثم كاش', async () => {
    mockFetch({ 'mymemory': () => J({ responseStatus: 200, responseData: { translatedText: 'inclusive education' } }) });
    const env = baseEnv({ CACHE: makeKV() });
    const t = async () => (await (await translateHandler({ request: req(`/api/proxy/translate?q=${encodeURIComponent('التعليم الدامج')}`), env })).json()) as { text: string };
    expect((await t()).text).toBe('inclusive education');
    expect((await t()).text).toBe('inclusive education');
    expect(calls).toHaveLength(1);
  });
  it('يرفض رسائل تحذير MyMemory والنص العربي المرتد', async () => {
    mockFetch({ 'mymemory': () => J({ responseStatus: 200, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' } }) });
    const r = await translateHandler({ request: req(`/api/proxy/translate?q=${encodeURIComponent('مناهج')}`), env: baseEnv() });
    expect(r.status).toBe(502);
  });
  it('النص الإنجليزي يمر بلا استدعاء خارجي، والسقف اليومي يوقف الخدمة', async () => {
    mockFetch({});
    const env = baseEnv();
    const ok = await translateHandler({ request: req('/api/proxy/translate?q=hello'), env });
    expect(await ok.json()).toEqual({ text: 'hello' });
    vi.unstubAllGlobals();
    mockFetch({ 'mymemory': () => J({ responseStatus: 200, responseData: { translatedText: 'ok' } }) });
    const capped = baseEnv({ TRANSLATE_GLOBAL_DAILY_CAP: '1' });
    expect((await translateHandler({ request: req(`/api/proxy/translate?q=${encodeURIComponent('أ')}x1`), env: capped })).status).toBe(200);
    expect((await translateHandler({ request: req(`/api/proxy/translate?q=${encodeURIComponent('ب')}x2`), env: capped })).status).toBe(503);
  });
});
