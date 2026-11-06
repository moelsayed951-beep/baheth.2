import type { FilterOptions, Paper, SourceOutput } from '@/types';
import { ALL_DEPARTMENTS } from '@/data/departments';
import { matchUniversity } from '@/data/universities';
import { CONTACT_EMAIL } from '@/utils/config';
import { fetchJson } from '@/utils/http';
import { englishOf, expandQuery } from '@/utils/queryExpander';
import { detectPublicationType } from '@/utils/text';

// معرف مجال "Education" في تصنيف OpenAlex (Subfield 3304 ضمن Social Sciences)
// ملاحظة: نظام Concepts القديم مُهمل لدى OpenAlex، والمعتمد الآن Topics/Subfields
const EDUCATION_SUBFIELD_ID = '3304';

// أنواع استجابة OpenAlex (الحقول المستخدمة فقط)
interface OAInstitution { display_name?: string; country_code?: string }
interface OAAuthorship { author?: { display_name?: string }; institutions?: OAInstitution[] }
interface OABiblio { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null }
interface OAWork {
  biblio?: OABiblio;
  id: string;
  doi?: string | null;
  title?: string | null;
  authorships?: OAAuthorship[];
  publication_year?: number | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  type?: string;
  open_access?: { is_oa?: boolean; oa_url?: string | null };
  cited_by_count?: number;
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null;
}
interface OAResponse { results?: OAWork[] }

// OpenAlex يُرجع الملخص كفهرس مقلوب؛ نعيد بناء النص
function parseAbstract(inverted?: Record<string, number[]> | null): string {
  if (!inverted) return '';
  const words: [string, number][] = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const p of positions) words.push([word, p]);
  }
  words.sort((a, b) => a[1] - b[1]);
  return words.map((w) => w[0]).join(' ');
}

function buildSearchText(filters: FilterOptions): string {
  const { original } = expandQuery(filters.query);
  const english = englishOf(filters.query, filters.englishQuery);
  const deptKeyword = filters.departments
    .map((id) => ALL_DEPARTMENTS.find((d) => d.id === id)?.keywords[0])
    .filter((k): k is string => Boolean(k))
    .join(' ');
  // نبقي النص العربي الأصلي ونضيف المرادف الإنجليزي لجلب نتائج المصادر العالمية
  return [original, english && english !== original ? english : '', deptKeyword].filter(Boolean).join(' ');
}

// level 'strict': كل الفلاتر التلقائية، 'relaxed': بدون فلتر المجال (لتفادي صفر نتائج)
function buildUrl(filters: FilterOptions, level: 'strict' | 'relaxed', limit: number): string {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', buildSearchText(filters));
  url.searchParams.set('per-page', String(limit));
  url.searchParams.set('page', String((filters.page ?? 0) + 1));
  url.searchParams.set(
    'select',
    'id,doi,title,authorships,publication_year,abstract_inverted_index,type,open_access,cited_by_count,primary_location,biblio'
  );
  if (CONTACT_EMAIL) url.searchParams.set('mailto', CONTACT_EMAIL);

  const f: string[] = [];
  if (filters.egyptOnly) f.push('authorships.institutions.country_code:EG');
  if (filters.domain === 'education' && level === 'strict') f.push(`topics.subfield.id:${EDUCATION_SUBFIELD_ID}`);
  if (filters.yearStart || filters.yearEnd) {
    f.push(`publication_year:${filters.yearStart ?? 1900}-${filters.yearEnd ?? new Date().getFullYear()}`);
  }
  if (filters.isOpenAccessOnly) f.push('open_access.is_oa:true');
  if (filters.typeFilter === 'thesis' || filters.typeFilter === 'master' || filters.typeFilter === 'phd') f.push('type:dissertation');
  if (filters.typeFilter === 'article') f.push('type:article');
  if (filters.typeFilter === 'book') f.push('type:book|book-chapter');
  if (f.length) url.searchParams.set('filter', f.join(','));
  return url.toString();
}

function mapWork(w: OAWork, domain: FilterOptions['domain']): Paper {
  const institutions = (w.authorships ?? []).flatMap((a) => a.institutions ?? []);
  const institution = institutions[0]?.display_name;
  const abstract = parseAbstract(w.abstract_inverted_index);
  const title = w.title?.trim() || 'بدون عنوان';
  return {
    id: `oa-${w.id.replace('https://openalex.org/', '')}`,
    doi: w.doi ? w.doi.replace('https://doi.org/', '') : undefined,
    title,
    authors: (w.authorships ?? []).map((a) => ({ name: a.author?.display_name ?? 'غير معروف' })),
    year: w.publication_year ?? 0,
    abstract,
    publicationType: detectPublicationType(title, abstract, w.type === 'dissertation', w.type),
    source: 'openalex',
    sources: ['openalex'],
    institution,
    universityId: matchUniversity(institution),
    domain,
    pdfUrl: w.open_access?.oa_url ?? undefined,
    isOpenAccess: Boolean(w.open_access?.is_oa),
    citationCount: w.cited_by_count ?? 0,
    sourceUrl: w.doi ?? w.primary_location?.landing_page_url ?? w.id,
    venue: w.primary_location?.source?.display_name ?? undefined,
    volume: w.biblio?.volume ?? undefined,
    issue: w.biblio?.issue ?? undefined,
    pages: w.biblio?.first_page ? [w.biblio.first_page, w.biblio.last_page].filter(Boolean).join('–') : undefined,
    // الدولة من بيانات الجهات في OpenAlex نفسها وليست من نص الاستعلام
    countryCodes: [...new Set(institutions.map((i) => i.country_code).filter((c): c is string => Boolean(c)))]
  };
}

export async function searchOpenAlex(filters: FilterOptions, signal?: AbortSignal, limit = 25): Promise<SourceOutput> {
  const strict = await fetchJson<OAResponse>(buildUrl(filters, 'strict', limit), signal);
  let results = strict.results ?? [];
  let note: string | undefined;

  // إذا كانت الفلاتر التلقائية صارمة جداً ولم تُرجع شيئاً نخفف فلتر المجال مرة واحدة
  if (results.length === 0 && filters.domain === 'education' && (filters.page ?? 0) === 0) {
    const relaxed = await fetchJson<OAResponse>(buildUrl(filters, 'relaxed', limit), signal);
    results = relaxed.results ?? [];
    if (results.length) note = 'خُفِّف فلتر مجال التربية لعدم وجود نتائج';
  }
  return { papers: results.map((w) => mapWork(w, filters.domain)), note };
}
