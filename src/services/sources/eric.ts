import type { FilterOptions, Paper } from '@/types';
import { ALL_DEPARTMENTS } from '@/data/departments';
import { matchUniversity } from '@/data/universities';
import { ERIC_API_BASE } from '@/utils/config';
import { fetchJson } from '@/utils/http';
import { englishOf, expandQuery } from '@/utils/queryExpander';
import { detectPublicationType } from '@/utils/text';
import { SourceSkipped } from '../errors';

interface EricDoc {
  id: string;
  title?: string;
  author?: string[];
  description?: string;
  publicationdateyear?: number;
  url?: string;
  e_fulltextauthorized?: boolean;
  publicationtype?: string[];
  institution?: string;
  source?: string;
}
interface EricResponse { response?: { docs?: EricDoc[] } }


export async function searchEric(filters: FilterOptions, signal?: AbortSignal, limit = 25): Promise<Paper[]> {
  // ERIC قاعدة إنجليزية، فنعتمد على ترجمة المصطلحات المعروفة
  const english = englishOf(filters.query, filters.englishQuery);
  const deptEnglish = filters.departments
    .map((id) => ALL_DEPARTMENTS.find((d) => d.id === id)?.keywords[0])
    .filter((k): k is string => Boolean(k))
    .map((k) => expandQuery(k).english)
    .filter(Boolean)
    .join(' ');
  const text = [english, deptEnglish].filter(Boolean).join(' ').replace(/["]/g, ' ').trim();
  if (!english) throw new SourceSkipped('لا توجد ترجمة إنجليزية معروفة للاستعلام');

  const base = ERIC_API_BASE.replace(/\/$/, '');
  const params = new URLSearchParams({ search: text, format: 'json', rows: String(limit), start: String((filters.page ?? 0) * limit) });
  const data = await fetchJson<EricResponse>(`${base}/?${params.toString()}`, signal);

  return (data.response?.docs ?? []).map((d): Paper => {
    const title = d.title?.trim() || 'Untitled';
    const abstract = d.description?.trim() ?? '';
    const isThesis = (d.publicationtype ?? []).some((t) => /dissertation|thesis/i.test(t));
    const fullText = Boolean(d.e_fulltextauthorized);
    return {
      id: `eric-${d.id}`,
      title,
      authors: (d.author ?? []).map((name) => ({ name })),
      year: d.publicationdateyear ?? 0,
      abstract,
      publicationType: detectPublicationType(title, abstract, isThesis),
      source: 'eric',
      sources: ['eric'],
      institution: d.institution,
      universityId: matchUniversity(d.institution),
      domain: filters.domain,
      pdfUrl: fullText ? `https://files.eric.ed.gov/fulltext/${d.id}.pdf` : undefined,
      isOpenAccess: fullText,
      citationCount: 0,
      sourceUrl: `https://eric.ed.gov/?id=${encodeURIComponent(d.id)}`,
      venue: d.source
    };
  });
}
