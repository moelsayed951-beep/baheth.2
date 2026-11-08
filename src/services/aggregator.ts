import type { AcademicSourceId, AggregateResult, FilterOptions, Paper, SortKey, SourceOutput, SourceReport } from '@/types';
import { normalizeText } from '@/utils/text';
import { applyFilters, type FilterStats } from './filters';
import { rankPapers } from './ranking';
import { searchCrossref } from './sources/crossref';
import { searchEric } from './sources/eric';
import { searchOpenAire } from './sources/openaire';
import { searchOpenAlex } from './sources/openalex';
import { searchSemanticScholar } from './sources/semanticscholar';
import { searchCore } from './sources/core';
import { classifyFailure } from './sourceIssues';
import { resolveEnglishQuery } from './translate';
import { WEB_LIBRARY_GROUPS, searchProxied, searchWebLibraries } from './sources/proxied';

const SOURCE_LABELS: Record<AcademicSourceId, string> = {
  openalex: 'OpenAlex',
  eric: 'ERIC',
  semanticscholar: 'Semantic Scholar',
  core: 'CORE',
  crossref: 'Crossref',
  openaire: 'OpenAIRE',
  pubmed: 'PubMed',
  base: 'BASE',
  doaj: 'DOAJ',
  arxiv: 'arXiv',
  europepmc: 'Europe PMC',
  zenodo: 'Zenodo',
  hal: 'HAL',
  ...Object.fromEntries(WEB_LIBRARY_GROUPS.map((g) => [g.id, g.label]))
} as Record<AcademicSourceId, string>;

// قائمة المصادر المعروضة كشارات أسفل مربع البحث (وللمؤشر أثناء البحث)
export const SOURCE_BADGES: { id: AcademicSourceId; label: string; kind: 'api' | 'web-search' }[] = [
  ...(['openalex', 'eric', 'semanticscholar', 'core', 'openaire', 'crossref', 'pubmed', 'base', 'doaj', 'arxiv', 'europepmc', 'zenodo', 'hal'] as const).map((id) => ({ id, label: SOURCE_LABELS[id], kind: 'api' as const })),
  ...WEB_LIBRARY_GROUPS.map((g) => ({ id: g.id, label: g.label, kind: 'web-search' as const }))
];

/* ============ إزالة التكرار (Deduplication) ============ */

// تشابه Dice على أزواج الحروف (bigrams) — سريع ومناسب للعناوين العربية والإنجليزية
function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/\s/g, '');
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

export function titleSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let total = 0;
  A.forEach((c, g) => { inter += Math.min(c, B.get(g) ?? 0); total += c; });
  B.forEach((c) => { total += c; });
  return total === 0 ? 0 : (2 * inter) / total;
}

const FUZZY_THRESHOLD = 0.9;

function isSamePaper(a: Paper, b: Paper, na: string, nb: string): boolean {
  if (a.doi && b.doi) return a.doi.toLowerCase() === b.doi.toLowerCase();
  if (na.length < 12 || nb.length < 12) return na === nb; // عناوين قصيرة: تطابق تام فقط
  if (Math.abs(na.length - nb.length) > Math.max(na.length, nb.length) * 0.25) return false;
  if (a.year && b.year && Math.abs(a.year - b.year) > 1) return false;
  return titleSimilarity(na, nb) >= FUZZY_THRESHOLD;
}

// دمج نسختين من نفس الورقة مع الاحتفاظ بأغنى البيانات
function mergePapers(a: Paper, b: Paper): Paper {
  return {
    ...a,
    doi: a.doi ?? b.doi,
    abstract: a.abstract.length >= b.abstract.length ? a.abstract : b.abstract,
    pdfUrl: a.pdfUrl ?? b.pdfUrl,
    isOpenAccess: a.isOpenAccess || b.isOpenAccess,
    provider: a.provider === 'api' || b.provider === 'api' ? 'api' : a.provider ?? b.provider,
    citationCount: Math.max(a.citationCount, b.citationCount),
    institution: a.institution ?? b.institution,
    universityId: a.universityId ?? b.universityId,
    year: a.year || b.year,
    authors: a.authors.length >= b.authors.length ? a.authors : b.authors,
    sources: [...new Set([...a.sources, ...b.sources])]
  };
}

// إزالة التكرار بفهارس (DOI / عنوان مطابق / سابقة العنوان) بدل مقارنة كل زوج، ليبقى سريعاً مع آلاف النتائج
export function deduplicate(list: Paper[]): Paper[] {
  const kept: { paper: Paper; norm: string }[] = [];
  const byDoi = new Map<string, number>();
  const byNorm = new Map<string, number>();
  const buckets = new Map<string, number[]>();
  const prefixOf = (n: string) => n.replace(/\s/g, '').slice(0, 10);

  for (const p of list) {
    const norm = normalizeText(p.title);
    const doi = p.doi?.toLowerCase();
    let idx = (doi !== undefined ? byDoi.get(doi) : undefined) ?? byNorm.get(norm);
    if (idx === undefined) {
      for (const i of buckets.get(prefixOf(norm)) ?? []) {
        if (isSamePaper(kept[i].paper, p, kept[i].norm, norm)) { idx = i; break; }
      }
    }
    if (idx !== undefined) {
      kept[idx] = { paper: mergePapers(kept[idx].paper, p), norm: kept[idx].norm };
      if (doi) byDoi.set(doi, idx);
    } else {
      const i = kept.push({ paper: p, norm }) - 1;
      if (doi) byDoi.set(doi, i);
      if (norm) byNorm.set(norm, i);
      const key = prefixOf(norm);
      const b = buckets.get(key);
      if (b) b.push(i); else buckets.set(key, [i]);
    }
  }
  return kept.map((k) => k.paper);
}

// توزيع النتائج بالتناوب بين المصادر لتنويع الصدارة (ترتيب "الأكثر صلة")
function interleave(lists: Paper[][]): Paper[] {
  const out: Paper[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const l of lists) if (l[i]) out.push(l[i]);
  }
  return out;
}

/* ============ التجميع من كل المصادر ============ */

const wrap = (p: Promise<Paper[]>): Promise<SourceOutput> => p.then((papers) => ({ papers }));

export interface AggregateOptions { includeWeb?: boolean } // includeWeb=false: لا نستهلك حصة بحث الويب (مثل فاحص التقارب)

export async function aggregateAllSources(filters: FilterOptions, signal?: AbortSignal, options: AggregateOptions = {}): Promise<AggregateResult> {
  // ترجمة الاستعلام مرة واحدة (قاموس ثم ترجمة آلية) لتوسيع البحث في القواعد الإنجليزية
  const englishQuery = await resolveEnglishQuery(filters.query, signal);
  filters = { ...filters, englishQuery };

  const tasks: { id: AcademicSourceId; run: () => Promise<SourceOutput> }[] = [
    { id: 'openalex', run: () => searchOpenAlex(filters, signal) },
    { id: 'eric', run: () => wrap(searchEric(filters, signal)) },
    { id: 'semanticscholar', run: () => wrap(searchSemanticScholar(filters, signal)) },
    { id: 'openaire', run: () => wrap(searchOpenAire(filters, signal)) },
    { id: 'crossref', run: () => wrap(searchCrossref(filters, signal)) },
    // مصادر عالمية جديدة عبر وسيط Cloudflare (مع كاش 30 دقيقة)
    { id: 'core', run: () => wrap(searchCore(filters, signal)) },
    ...(['pubmed', 'base', 'doaj', 'arxiv', 'europepmc', 'zenodo', 'hal'] as const).map((id) => ({ id: id as AcademicSourceId, run: () => wrap(searchProxied(id, filters, signal)) })),
    // مكتبات عربية/محلية/ناشرون عبر بحث الويب (site:)
    ...(options.includeWeb === false ? [] : WEB_LIBRARY_GROUPS).map((g) => ({ id: g.id as AcademicSourceId, run: () => wrap(searchWebLibraries(g, filters, signal)) }))
  ];

  // allSettled: تعطل أي مصدر (أو انتهاء مهلته 10ث) لا يمنع ظهور نتائج الباقي
  const settled = await Promise.allSettled(tasks.map((t) => t.run()));

  const reports: SourceReport[] = [];
  const lists: Paper[][] = [];
  settled.forEach((res, i) => {
    const id = tasks[i].id;
    const label = SOURCE_LABELS[id];
    if (res.status === 'fulfilled') {
      lists.push(res.value.papers);
      reports.push({ id, label, kind: WEB_LIBRARY_GROUPS.some((g) => g.id === id) ? 'web-search' : 'api', status: 'ok', count: res.value.papers.length, message: res.value.note });
    } else {
      // تصنيف السبب: «يحتاج إعداداً» (مفتاح/تسجيل/IP) يُعرض بهدوء، والفشل الحقيقي يُعرض كخطأ صغير
      const c = classifyFailure(id, res.reason);
      reports.push({ id, label, status: c.status, count: 0, message: c.message, issue: c.issue });
    }
  });

  return { papers: deduplicate(interleave(lists)), reports, englishQuery };
}

// تطبيق الفلاتر والترتيب على جانب العميل (بعد الجلب) — تضمن اتساق النتائج بين المصادر
export interface FilteredResult { papers: Paper[]; stats: FilterStats }

// الفلترة الدقيقة (سنة/قسم/مصر/نوع/جامعة) ثم الترتيب: الصلة = ترتيب علمي موحّد عبر كل المصادر
export function filterAndSort(papers: Paper[], filters: FilterOptions, sort: SortKey): FilteredResult {
  const { papers: kept, stats } = applyFilters(papers, filters);
  let out = kept;
  if (sort === 'relevance') out = rankPapers(kept, filters.query, filters.englishQuery);
  if (sort === 'year') out = [...kept].sort((a, b) => b.year - a.year);
  if (sort === 'citations') out = [...kept].sort((a, b) => b.citationCount - a.citationCount);
  return { papers: out, stats };
}

// دمج تقارير الصفحات المتتابعة: المصدر «ناجح» إن نجح في أي صفحة، والأعداد تُجمع
export function mergeReports(pages: AggregateResult[]): SourceReport[] {
  const out = new Map<AcademicSourceId, SourceReport>();
  for (const page of pages) {
    for (const r of page.reports) {
      const prev = out.get(r.id);
      if (!prev) { out.set(r.id, { ...r }); continue; }
      const ok = prev.status === 'ok' || r.status === 'ok';
      out.set(r.id, { ...prev, status: ok ? 'ok' : r.status, count: prev.count + r.count, message: ok ? prev.message : r.message, issue: ok ? undefined : r.issue ?? prev.issue });
    }
  }
  return [...out.values()];
}
