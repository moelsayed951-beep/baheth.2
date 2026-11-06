import type { FilterOptions, Paper } from '@/types';
import { ALL_DEPARTMENTS } from '@/data/departments';
import { matchUniversity } from '@/data/universities';
import { CONTACT_EMAIL } from '@/utils/config';
import { fetchJson } from '@/utils/http';
import { detectPublicationType, stripHtml } from '@/utils/text';

interface CRAuthor { given?: string; family?: string; name?: string }
export interface CRItem {
  DOI: string;
  title?: string[];
  author?: CRAuthor[];
  abstract?: string;
  type?: string;
  publisher?: string;
  'container-title'?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  institution?: { name?: string }[];
  issued?: { 'date-parts'?: (number | null)[][] };
  created?: { 'date-parts'?: (number | null)[][] };
  'is-referenced-by-count'?: number;
  link?: { URL: string; 'content-type'?: string }[];
}
interface CRResponse { message?: { items?: CRItem[] } }

export async function searchCrossref(filters: FilterOptions, signal?: AbortSignal, limit = 25): Promise<Paper[]> {
  const deptKeyword = filters.departments
    .map((id) => ALL_DEPARTMENTS.find((d) => d.id === id)?.keywords[0])
    .filter((k): k is string => Boolean(k))
    .join(' ');
  // Crossref لا يوفّر دولة الجهة، فلا نلوّث الاستعلام بكلمة «مصر»: فلتر مصر يُطبَّق لاحقاً على بيانات الجهة المتحقق منها
  const q = [filters.query, deptKeyword].filter(Boolean).join(' ');

  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query.bibliographic', q);
  url.searchParams.set('rows', String(limit));
  url.searchParams.set('offset', String((filters.page ?? 0) * limit));
  if (CONTACT_EMAIL) url.searchParams.set('mailto', CONTACT_EMAIL);

  const f: string[] = [];
  if (filters.yearStart) f.push(`from-pub-date:${filters.yearStart}`);
  if (filters.yearEnd) f.push(`until-pub-date:${filters.yearEnd}`);
  if (filters.typeFilter === 'thesis' || filters.typeFilter === 'master' || filters.typeFilter === 'phd') f.push('type:dissertation');
  if (filters.typeFilter === 'article') f.push('type:journal-article');
  // تكرار نفس الفلتر في Crossref يعني OR
  if (filters.typeFilter === 'book') f.push('type:book', 'type:monograph', 'type:edited-book');
  if (f.length) url.searchParams.set('filter', f.join(','));

  const data = await fetchJson<CRResponse>(url.toString(), signal);

  return (data.message?.items ?? []).map((item) => mapCrossrefItem(item, filters.domain));
}

export function mapCrossrefItem(item: CRItem, domain: FilterOptions['domain']): Paper {
  const title = item.title?.[0]?.trim() || 'بدون عنوان';
  const container = item['container-title']?.[0];
  const institution = item.institution?.[0]?.name;
  const abstract = item.abstract ? stripHtml(item.abstract) : '';
  const year = item.issued?.['date-parts']?.[0]?.[0] ?? item.created?.['date-parts']?.[0]?.[0] ?? 0;
  const pdf = item.link?.find((l) => l['content-type'] === 'application/pdf')?.URL;
  return {
      id: `cr-${item.DOI}`,
      doi: item.DOI,
      title,
      authors: (item.author ?? []).map((a) => ({
        name: a.name ?? ([a.given, a.family].filter(Boolean).join(' ') || 'غير معروف')
      })),
      year,
      abstract,
      publicationType: detectPublicationType(title, abstract, item.type === 'dissertation', item.type),
      source: 'crossref',
      sources: ['crossref'],
      institution,
      universityId: matchUniversity(institution),
      domain,
      pdfUrl: pdf,
      // Crossref لا يوفر حالة الإتاحة المفتوحة بشكل موثوق، فلا نفترضها
      isOpenAccess: false,
      citationCount: item['is-referenced-by-count'] ?? 0,
      sourceUrl: `https://doi.org/${item.DOI}`,
      venue: container,
      publisher: item.publisher,
      volume: item.volume,
      issue: item.issue,
      pages: item.page
    };
}
