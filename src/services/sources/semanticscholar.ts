import type { FilterOptions, Paper } from '@/types';
import { fetchJson } from '@/utils/http';
import { englishOf } from '@/utils/queryExpander';
import { detectPublicationType } from '@/utils/text';
import { SourceSkipped } from '../errors';

interface S2Paper {
  paperId: string;
  title?: string;
  abstract?: string | null;
  year?: number | null;
  authors?: { name?: string }[];
  citationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: { url?: string } | null;
  externalIds?: { DOI?: string } | null;
  url?: string;
  venue?: string;
}
interface S2Response { data?: S2Paper[] }

export async function searchSemanticScholar(filters: FilterOptions, signal?: AbortSignal, limit = 25): Promise<Paper[]> {
  // Semantic Scholar يعمل أفضل بالإنجليزية
  const english = englishOf(filters.query, filters.englishQuery);
  if (!english) throw new SourceSkipped('لا توجد ترجمة إنجليزية معروفة للاستعلام');

  const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
  url.searchParams.set('query', [english].filter(Boolean).join(' '));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String((filters.page ?? 0) * limit));
  url.searchParams.set('fields', 'title,abstract,year,authors,citationCount,isOpenAccess,openAccessPdf,externalIds,url,venue');
  if (filters.yearStart || filters.yearEnd) {
    url.searchParams.set('year', `${filters.yearStart ?? ''}-${filters.yearEnd ?? ''}`);
  }
  if (filters.isOpenAccessOnly) url.searchParams.set('openAccessPdf', '');

  const data = await fetchJson<S2Response>(url.toString(), signal);
  return (data.data ?? []).map((p): Paper => {
    const title = p.title?.trim() || 'Untitled';
    const abstract = p.abstract?.trim() ?? '';
    const doi = p.externalIds?.DOI;
    return {
      id: `s2-${p.paperId}`,
      doi,
      title,
      authors: (p.authors ?? []).map((a) => ({ name: a.name ?? 'Unknown' })),
      year: p.year ?? 0,
      abstract,
      publicationType: detectPublicationType(title, abstract, false),
      source: 'semanticscholar',
      sources: ['semanticscholar'],
      venue: p.venue || undefined,
      domain: filters.domain,
      pdfUrl: p.openAccessPdf?.url || undefined,
      isOpenAccess: Boolean(p.isOpenAccess || p.openAccessPdf?.url),
      citationCount: p.citationCount ?? 0,
      sourceUrl: doi ? `https://doi.org/${doi}` : (p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`)
    };
  });
}
