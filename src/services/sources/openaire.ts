import type { FilterOptions, Paper } from '@/types';
import { fetchJson } from '@/utils/http';
import { detectPublicationType } from '@/utils/text';

// OpenAIRE Graph API (v1) — الحقول المستخدمة فقط، وكلها اختيارية لأن الشكل يتفاوت بين السجلات
interface OAIRProduct {
  id: string;
  mainTitle?: string;
  description?: string[];
  publicationDate?: string;
  authors?: { fullName?: string }[];
  pids?: { scheme?: string; value?: string }[];
  bestAccessRight?: { code?: string; label?: string };
  instances?: { urls?: string[] }[];
  type?: string;
}
interface OAIRResponse { results?: OAIRProduct[] }

export async function searchOpenAire(filters: FilterOptions, signal?: AbortSignal, limit = 25): Promise<Paper[]> {
  const url = new URL('https://api.openaire.eu/graph/v1/researchProducts');
  url.searchParams.set('search', filters.query);
  url.searchParams.set('type', 'publication');
  url.searchParams.set('pageSize', String(limit));
  url.searchParams.set('page', String((filters.page ?? 0) + 1));
  if (filters.egyptOnly) url.searchParams.set('countryCode', 'EG');
  if (filters.yearStart) url.searchParams.set('fromPublicationDate', `${filters.yearStart}-01-01`);
  if (filters.yearEnd) url.searchParams.set('toPublicationDate', `${filters.yearEnd}-12-31`);

  const data = await fetchJson<OAIRResponse>(url.toString(), signal);
  return (data.results ?? []).map((r): Paper => {
    const title = r.mainTitle?.trim() || 'بدون عنوان';
    const abstract = r.description?.[0]?.trim() ?? '';
    const doi = r.pids?.find((p) => p.scheme?.toLowerCase() === 'doi')?.value;
    const link = r.instances?.flatMap((i) => i.urls ?? [])[0];
    const open = (r.bestAccessRight?.label ?? '').toLowerCase().includes('open');
    return {
      id: `oair-${r.id}`,
      doi,
      title,
      authors: (r.authors ?? []).map((a) => ({ name: a.fullName ?? 'غير معروف' })),
      year: Number(r.publicationDate?.slice(0, 4)) || 0,
      abstract,
      publicationType: detectPublicationType(title, abstract, false),
      source: 'openaire',
      sources: ['openaire'],
      domain: filters.domain,
      isOpenAccess: open,
      // الدولة محققة من فلتر OpenAIRE نفسه عند اختيار «مصر»
      countryCodes: filters.egyptOnly ? ['EG'] : undefined,
      citationCount: 0,
      sourceUrl: doi ? `https://doi.org/${doi}` : (link ?? `https://explore.openaire.eu/search/publication?pid=${encodeURIComponent(r.id)}`)
    };
  });
}
