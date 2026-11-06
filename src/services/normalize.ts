// ============================================================
// normalizeData: يحوّل أي نتيجة موحّدة (UnifiedResearchResult) إلى نموذج Paper المستخدم في الواجهة.
// كل مصدر جديد (API أو بحث ويب) يمر من هنا ولا يلمس الواجهة مباشرة.
// ============================================================
import type { AcademicDomain, AcademicSourceId, Paper, PublicationType, UnifiedResearchResult } from '@/types';
import { matchUniversity } from '@/data/universities';
import { detectPublicationType } from '@/utils/text';

function toPublicationType(r: UnifiedResearchResult): PublicationType {
  if (r.type === 'book') return 'book';
  if (r.type === 'thesis') return detectPublicationType(r.title, r.abstract ?? '', true);
  return detectPublicationType(r.title, r.abstract ?? '', false);
}

export function normalizeData(items: UnifiedResearchResult[], source: AcademicSourceId, domain: AcademicDomain): Paper[] {
  return items.map((r): Paper => ({
    id: r.id,
    doi: r.doi,
    title: r.title,
    authors: r.authors.map((name) => ({ name })),
    year: Number(r.year) || 0,
    abstract: r.abstract ?? '',
    publicationType: toPublicationType(r),
    source,
    sources: [source],
    institution: r.institution,
    venue: r.venue,
    publisher: r.publisher,
    volume: r.volume,
    issue: r.issue,
    pages: r.pages,
    universityId: matchUniversity(r.institution ?? (r.provider === 'web-search' ? undefined : r.source)),
    domain,
    pdfUrl: r.pdfUrl,
    isOpenAccess: Boolean(r.openAccess),
    citationCount: 0,
    sourceUrl: r.url,
    provider: r.provider,
    sourceLabel: r.source
  }));
}
