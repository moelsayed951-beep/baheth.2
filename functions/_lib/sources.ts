// ============================================================
// محوّلات المصادر الأكاديمية العالمية على الخادم: PubMed, BASE, DOAJ, arXiv
// كل محوّل يرجع صيغة موحّدة UnifiedResearchResult (توحيد البيانات الأول على الخادم).
// ============================================================
import { HttpFail, fetchWithTimeout, plainText, safeHttpUrl, upstreamFailure, type Env } from './shared';

export type ProxySourceId = 'pubmed' | 'base' | 'doaj' | 'arxiv' | 'europepmc' | 'zenodo' | 'hal' | 'core' | 'semanticscholar';
export const PROXY_SOURCES: ProxySourceId[] = ['pubmed', 'base', 'doaj', 'arxiv', 'europepmc', 'zenodo', 'hal', 'core', 'semanticscholar'];

// خيارات إضافية لكل طلب: مفتاح المستخدم الخاص (BYOK، له الأولوية على مفتاح المنصة) وسنوات للتصفية المبكرة
export interface SourceOpts { userKey?: string; yearStart?: number; yearEnd?: number }
export const MAX_PAGE = 49; // حد أقصى معقول للتعمّق (≈1000 نتيجة لكل مصدر)

export interface UnifiedResearchResult {
  id: string;
  title: string;
  authors: string[];
  source: string;
  year: string;
  type: 'thesis' | 'article' | 'book';
  abstract?: string;
  url: string;
  doi?: string;
  provider: 'api' | 'web-search';
  pdfUrl?: string;
  openAccess?: boolean;
  citationCount?: number;
  institution?: string;
  venue?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
}

export const SOURCE_LIMIT = 20;
const TIMEOUT = 12000;

const yearOf = (v: unknown): string => {
  const m = /\b(1[89]\d{2}|20\d{2})\b/.exec(String(v ?? ''));
  return m ? m[1] : '';
};
const arr = <T>(v: T | T[] | undefined | null): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const guessType = (t: string): UnifiedResearchResult['type'] =>
  /thesis|dissertation|ماجستير|دكتوراه/i.test(t) ? 'thesis' : /\bbook\b|monograph|كتاب/i.test(t) ? 'book' : 'article';

/* ---------------- PubMed (NCBI E-utilities) ---------------- */
interface ESearch { esearchresult?: { idlist?: string[] } }
interface ESummary { result?: Record<string, { uid?: string; title?: string; authors?: { name?: string }[]; pubdate?: string; source?: string; articleids?: { idtype?: string; value?: string }[]; volume?: string; issue?: string; pages?: string; fulljournalname?: string }> }

async function pubmed(env: Env, q: string, page: number): Promise<UnifiedResearchResult[]> {
  const key = env.NCBI_API_KEY ? `&api_key=${encodeURIComponent(env.NCBI_API_KEY)}` : ''; // 🔑
  const base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const s = await fetchWithTimeout(`${base}/esearch.fcgi?db=pubmed&retmode=json&retmax=${SOURCE_LIMIT}&retstart=${page * SOURCE_LIMIT}&sort=relevance&term=${encodeURIComponent(q)}${key}`, {}, TIMEOUT);
  if (!s.ok) throw upstreamFailure(s.status, 'PubMed');
  const ids = ((await s.json()) as ESearch).esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  const r = await fetchWithTimeout(`${base}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}${key}`, {}, TIMEOUT);
  if (!r.ok) throw upstreamFailure(r.status, 'PubMed');
  const data = ((await r.json()) as ESummary).result ?? {};
  return ids.flatMap((id): UnifiedResearchResult[] => {
    const d = data[id];
    if (!d?.title) return [];
    const doi = d.articleids?.find((a) => a.idtype === 'doi')?.value;
    return [{
      id: `pubmed-${id}`, title: plainText(d.title), authors: (d.authors ?? []).map((a) => a.name ?? '').filter(Boolean),
      source: 'PubMed', year: yearOf(d.pubdate), type: 'article', url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, doi, provider: 'api',
      venue: d.fulljournalname || d.source, volume: d.volume || undefined, issue: d.issue || undefined, pages: d.pages || undefined
    }];
  });
}

/* ---------------- DOAJ ---------------- */
interface DoajResp { results?: { id?: string; bibjson?: { journal?: { title?: string; volume?: string; number?: string }; start_page?: string; end_page?: string; title?: string; year?: string; abstract?: string; author?: { name?: string }[]; identifier?: { type?: string; id?: string }[]; link?: { url?: string; type?: string }[] } }[] }

async function doaj(_env: Env, q: string, page: number): Promise<UnifiedResearchResult[]> {
  const res = await fetchWithTimeout(`https://doaj.org/api/search/articles/${encodeURIComponent(q)}?pageSize=${SOURCE_LIMIT}&page=${page + 1}`, { headers: { Accept: 'application/json' } }, TIMEOUT);
  if (!res.ok) throw upstreamFailure(res.status, 'DOAJ');
  const data = (await res.json()) as DoajResp;
  return (data.results ?? []).flatMap((r): UnifiedResearchResult[] => {
    const b = r.bibjson;
    if (!b?.title) return [];
    const doi = b.identifier?.find((i) => i.type?.toLowerCase() === 'doi')?.id;
    const full = b.link?.find((l) => l.type === 'fulltext')?.url ?? b.link?.[0]?.url;
    const url = (full && safeHttpUrl(full)) || (doi ? `https://doi.org/${doi}` : `https://doaj.org/article/${r.id ?? ''}`);
    return [{
      id: `doaj-${r.id ?? url}`, title: plainText(b.title), authors: (b.author ?? []).map((a) => a.name ?? '').filter(Boolean),
      source: 'DOAJ', year: yearOf(b.year), type: 'article', abstract: b.abstract ? plainText(b.abstract) : undefined, url, doi, provider: 'api', openAccess: true,
      venue: b.journal?.title, volume: b.journal?.volume, issue: b.journal?.number,
      pages: b.start_page ? [b.start_page, b.end_page].filter(Boolean).join('–') : undefined
    }];
  });
}

/* ---------------- arXiv (Atom XML) ---------------- */
const tag = (xml: string, name: string): string => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml)?.[1] ?? '';

async function arxiv(_env: Env, q: string, page: number): Promise<UnifiedResearchResult[]> {
  const res = await fetchWithTimeout(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(`all:${q}`)}&max_results=${SOURCE_LIMIT}&start=${page * SOURCE_LIMIT}&sortBy=relevance`, {}, TIMEOUT);
  if (!res.ok) throw upstreamFailure(res.status, 'arXiv');
  const xml = await res.text();
  return (xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []).flatMap((e): UnifiedResearchResult[] => {
    const rawId = plainText(tag(e, 'id'));
    const title = plainText(tag(e, 'title'));
    if (!rawId || !title) return [];
    const short = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, '');
    const authors = (e.match(/<author>[\s\S]*?<\/author>/g) ?? []).map((a) => plainText(tag(a, 'name'))).filter(Boolean);
    return [{
      id: `arxiv-${short}`, title, authors, source: 'arXiv', year: yearOf(tag(e, 'published')), type: 'article',
      abstract: plainText(tag(e, 'summary')), url: `https://arxiv.org/abs/${short}`, pdfUrl: `https://arxiv.org/pdf/${short}`,
      doi: plainText(tag(e, 'arxiv:doi')) || undefined, provider: 'api', openAccess: true, venue: 'arXiv (نسخة أولية)'
    }];
  });
}

/* ---------------- BASE (Bielefeld) ---------------- */
// ⚠️ BASE يشترط تسجيل عنوان IP للخادم لديهم (مجاناً) عبر base-search.net؛ بدونه يرد 403 فنُبلغ الواجهة بوضوح.
interface BaseDoc { dctitle?: string; dccreator?: string | string[]; dcyear?: number | string; dcdescription?: string; dcdoi?: string | string[]; dclink?: string; dcidentifier?: string | string[]; dctypenorm?: string | string[]; dcoa?: number | string; dcsource?: string | string[]; dcdocid?: string }
interface BaseResp { response?: { docs?: BaseDoc[] } }

async function base(env: Env, q: string, page: number): Promise<UnifiedResearchResult[]> {
  const params = new URLSearchParams({ func: 'PerformSearch', query: q, hits: String(SOURCE_LIMIT), offset: String(page * SOURCE_LIMIT), format: 'json', sortby: 'dcyear desc' });
  const res = await fetchWithTimeout(`https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': env.BASE_USER_AGENT ?? 'BahethResearchPortal/1.0' }
  }, 15000);
  if (res.status === 403) throw new HttpFail(502, 'base_ip_not_registered', 'BASE يرفض الطلب: سجّل عنوان IP للخادم مجاناً لدى BASE (راجع README).');
  if (!res.ok) throw upstreamFailure(res.status, 'BASE');
  const data = (await res.json()) as BaseResp;
  return (data.response?.docs ?? []).flatMap((d): UnifiedResearchResult[] => {
    const title = typeof d.dctitle === 'string' ? plainText(d.dctitle) : '';
    const url = d.dclink ? safeHttpUrl(d.dclink) : null;
    if (!title || !url) return [];
    const doi = arr(d.dcdoi)[0]?.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
    const typeNorm = arr(d.dctypenorm).join(' ');
    return [{
      id: `base-${d.dcdocid ?? url}`, title, authors: arr(d.dccreator).map((a) => plainText(a)).filter(Boolean),
      source: 'BASE', institution: arr(d.dcsource)[0] ? plainText(arr(d.dcsource)[0]) : undefined, year: yearOf(d.dcyear),
      type: guessType(`${typeNorm} ${title}`), abstract: d.dcdescription ? plainText(d.dcdescription) : undefined, url, doi, provider: 'api', openAccess: String(d.dcoa) === '1'
    }];
  });
}

/* ---------------- Europe PMC (طب وعلوم حياة ونفس، مع ملخصات) ---------------- */
interface EpmcResp { resultList?: { result?: { id?: string; source?: string; doi?: string; title?: string; authorString?: string; pubYear?: string; abstractText?: string; isOpenAccess?: string; journalInfo?: { volume?: string; issue?: string; journal?: { title?: string } }; pageInfo?: string }[] } }

async function europepmc(_env: Env, q: string, page: number): Promise<UnifiedResearchResult[]> {
  const params = new URLSearchParams({ query: q, format: 'json', resultType: 'core', pageSize: String(SOURCE_LIMIT), page: String(page + 1) });
  const res = await fetchWithTimeout(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`, { headers: { Accept: 'application/json' } }, TIMEOUT);
  if (!res.ok) throw upstreamFailure(res.status, 'Europe PMC');
  const data = (await res.json()) as EpmcResp;
  return (data.resultList?.result ?? []).flatMap((r): UnifiedResearchResult[] => {
    if (!r.title || !r.id) return [];
    const url = r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source ?? 'MED'}/${r.id}`;
    return [{
      id: `epmc-${r.source ?? 'x'}-${r.id}`, title: plainText(r.title), authors: (r.authorString ?? '').split(',').map((a) => a.trim().replace(/\.$/, '')).filter(Boolean),
      source: 'Europe PMC', year: yearOf(r.pubYear), type: 'article', abstract: r.abstractText ? plainText(r.abstractText) : undefined, url, doi: r.doi, provider: 'api', openAccess: r.isOpenAccess === 'Y',
      venue: r.journalInfo?.journal?.title, volume: r.journalInfo?.volume, issue: r.journalInfo?.issue, pages: r.pageInfo
    }];
  });
}

/* ---------------- Zenodo (أبحاث ورسائل وبيانات بحثية مفتوحة) ---------------- */
interface ZenodoResp { hits?: { hits?: { id?: number; links?: { self_html?: string }; metadata?: { title?: string; creators?: { name?: string }[]; publication_date?: string; description?: string; doi?: string; resource_type?: { type?: string; subtype?: string }; journal?: { title?: string; volume?: string; issue?: string; pages?: string } } }[] } }

async function zenodo(env: Env, q: string, page: number): Promise<UnifiedResearchResult[]> {
  const params = new URLSearchParams({ q, size: String(SOURCE_LIMIT), page: String(page + 1), type: 'publication' });
  // Zenodo قد يرفض الطلبات المجهولة من عناوين الخوادم (403): نعرّف التطبيق، ونستخدم رمز وصول اختياري إن أُضيف
  const res = await fetchWithTimeout(`https://zenodo.org/api/records?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'BahethResearchPortal/1.0 (open research search)', ...(env.ZENODO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.ZENODO_ACCESS_TOKEN}` } : {}) }
  }, TIMEOUT);
  if (!res.ok) throw upstreamFailure(res.status, 'Zenodo');
  const data = (await res.json()) as ZenodoResp;
  return (data.hits?.hits ?? []).flatMap((h): UnifiedResearchResult[] => {
    const m = h.metadata;
    const url = h.links?.self_html ? safeHttpUrl(h.links.self_html) : null;
    if (!m?.title || !url) return [];
    const kind = `${m.resource_type?.type ?? ''} ${m.resource_type?.subtype ?? ''}`;
    return [{
      id: `zenodo-${h.id ?? url}`, title: plainText(m.title), authors: (m.creators ?? []).map((c) => c.name ?? '').filter(Boolean),
      source: 'Zenodo', year: yearOf(m.publication_date), type: /thesis/i.test(kind) ? 'thesis' : /\bbook\b/i.test(kind) ? 'book' : 'article',
      abstract: m.description ? plainText(m.description) : undefined, url, doi: m.doi, provider: 'api', openAccess: true,
      venue: m.journal?.title, volume: m.journal?.volume, issue: m.journal?.issue, pages: m.journal?.pages
    }];
  });
}

/* ---------------- HAL (الأرشيف المفتوح الفرنسي — رسائل دكتوراه وأبحاث) ---------------- */
interface HalResp { response?: { docs?: { halId_s?: string; title_s?: string[]; authFullName_s?: string[]; producedDateY_i?: number; abstract_s?: string[]; doiId_s?: string; uri_s?: string; docType_s?: string; fileMain_s?: string; openAccess_bool?: boolean; journalTitle_s?: string }[] } }

async function hal(_env: Env, q: string, page: number): Promise<UnifiedResearchResult[]> {
  const params = new URLSearchParams({ q, wt: 'json', rows: String(SOURCE_LIMIT), start: String(page * SOURCE_LIMIT), fl: 'halId_s,title_s,authFullName_s,producedDateY_i,abstract_s,doiId_s,uri_s,docType_s,fileMain_s,openAccess_bool,journalTitle_s' });
  const res = await fetchWithTimeout(`https://api.archives-ouvertes.fr/search/?${params.toString()}`, { headers: { Accept: 'application/json' } }, TIMEOUT);
  if (!res.ok) throw upstreamFailure(res.status, 'HAL');
  const data = (await res.json()) as HalResp;
  return (data.response?.docs ?? []).flatMap((d): UnifiedResearchResult[] => {
    const title = d.title_s?.[0];
    const url = d.uri_s ? safeHttpUrl(d.uri_s) : null;
    if (!title || !url) return [];
    const dt = d.docType_s ?? '';
    return [{
      id: `hal-${d.halId_s ?? url}`, title: plainText(title), authors: d.authFullName_s ?? [], source: 'HAL', year: yearOf(d.producedDateY_i),
      type: /^(THESE|HDR|MEM)$/.test(dt) ? 'thesis' : /^(OUV|COUV|DOUV)$/.test(dt) ? 'book' : 'article',
      abstract: d.abstract_s?.[0] ? plainText(d.abstract_s[0]) : undefined, url, doi: d.doiId_s, pdfUrl: d.fileMain_s ? safeHttpUrl(d.fileMain_s) ?? undefined : undefined, provider: 'api', openAccess: Boolean(d.openAccess_bool), venue: d.journalTitle_s
    }];
  });
}

/* ---------------- CORE (مفتاح على الخادم فقط) ---------------- */
interface CoreResp { results?: { id?: number | string; title?: string; abstract?: string | null; authors?: { name?: string }[]; yearPublished?: number | null; doi?: string | null; downloadUrl?: string | null; publisher?: string | null; dataProviders?: { name?: string }[]; documentType?: string | null; journals?: { title?: string }[] }[] }

async function core(env: Env, q: string, page: number, opts: SourceOpts = {}): Promise<UnifiedResearchResult[]> {
  const key = opts.userKey || env.CORE_API_KEY; // مفتاح المستخدم أولاً، ثم مفتاح المنصة
  if (!key) throw new HttpFail(503, 'not_configured', 'CORE غير مفعّل: أضف مفتاحك من صفحة «مفاتيحي» أو CORE_API_KEY في إعدادات Cloudflare (مفتاح مجاني من core.ac.uk).');
  const params = new URLSearchParams({ q, limit: String(SOURCE_LIMIT), offset: String(page * SOURCE_LIMIT) });
  const res = await fetchWithTimeout(`https://api.core.ac.uk/v3/search/works?${params.toString()}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${key}` } }, 15000);
  if (!res.ok) throw upstreamFailure(res.status, 'CORE');
  const data = (await res.json()) as CoreResp;
  return (data.results ?? []).flatMap((w): UnifiedResearchResult[] => {
    if (!w.title || w.id === undefined) return [];
    const url = w.doi ? `https://doi.org/${w.doi}` : `https://core.ac.uk/works/${w.id}`;
    return [{
      id: `core-${w.id}`, title: plainText(w.title), authors: (w.authors ?? []).map((a) => a.name ?? '').filter(Boolean), source: 'CORE', year: yearOf(w.yearPublished),
      type: /thesis/i.test(w.documentType ?? '') ? 'thesis' : /book/i.test(w.documentType ?? '') ? 'book' : 'article',
      abstract: w.abstract ? plainText(w.abstract) : undefined, url, doi: w.doi ?? undefined, provider: 'api', openAccess: true,
      pdfUrl: w.downloadUrl ? safeHttpUrl(w.downloadUrl) ?? undefined : undefined,
      institution: w.dataProviders?.[0]?.name, venue: w.journals?.[0]?.title, publisher: w.publisher ?? undefined
    }];
  });
}

/* ---------------- Semantic Scholar (مفتاح المستخدم ← مفتاح المنصة S2_API_KEY ← بلا مفتاح) ---------------- */
interface S2Resp { data?: { paperId: string; title?: string; abstract?: string | null; year?: number | null; authors?: { name?: string }[]; citationCount?: number; isOpenAccess?: boolean; openAccessPdf?: { url?: string } | null; externalIds?: { DOI?: string } | null; url?: string; venue?: string; publicationTypes?: string[] | null }[] }

async function semanticscholar(env: Env, q: string, page: number, opts: SourceOpts = {}): Promise<UnifiedResearchResult[]> {
  const params = new URLSearchParams({ query: q, limit: String(SOURCE_LIMIT), offset: String(page * SOURCE_LIMIT), fields: 'title,abstract,year,authors,citationCount,isOpenAccess,openAccessPdf,externalIds,url,venue,publicationTypes' });
  if (opts.yearStart || opts.yearEnd) params.set('year', `${opts.yearStart ?? ''}-${opts.yearEnd ?? ''}`);
  const key = opts.userKey || env.S2_API_KEY;
  const res = await fetchWithTimeout(`https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`, {
    headers: { Accept: 'application/json', ...(key ? { 'x-api-key': key } : {}) } // 🔑 في الترويسة لا الرابط
  }, 15000);
  if (!res.ok) throw upstreamFailure(res.status, 'Semantic Scholar');
  const data = (await res.json()) as S2Resp;
  return (data.data ?? []).flatMap((p): UnifiedResearchResult[] => {
    if (!p.title?.trim()) return [];
    const doi = p.externalIds?.DOI ?? undefined;
    const url = doi ? `https://doi.org/${doi}` : safeHttpUrl(p.url ?? '') ?? `https://www.semanticscholar.org/paper/${p.paperId}`;
    return [{
      id: `s2-${p.paperId}`, title: plainText(p.title), authors: (p.authors ?? []).map((a) => a.name ?? '').filter(Boolean), source: 'Semantic Scholar', year: yearOf(p.year),
      type: (p.publicationTypes ?? []).includes('Book') ? 'book' : guessType(p.title), abstract: p.abstract ? plainText(p.abstract) : undefined, url, doi, provider: 'api',
      openAccess: Boolean(p.isOpenAccess || p.openAccessPdf?.url), pdfUrl: p.openAccessPdf?.url ? safeHttpUrl(p.openAccessPdf.url) ?? undefined : undefined,
      venue: p.venue || undefined, citationCount: p.citationCount ?? 0
    }];
  });
}

const ADAPTERS: Record<ProxySourceId, (env: Env, q: string, page: number, opts?: SourceOpts) => Promise<UnifiedResearchResult[]>> = { pubmed, base, doaj, arxiv, europepmc, zenodo, hal, core, semanticscholar };

export const runSource = (src: ProxySourceId, env: Env, q: string, page = 0, opts: SourceOpts = {}): Promise<UnifiedResearchResult[]> => ADAPTERS[src](env, q, page, opts);
