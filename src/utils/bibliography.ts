import type { Paper } from '@/types';
import { CITATION_STYLES, formatCitation, sortForBibliography, type CitationStyle } from '@/utils/citations';
import type { ExportDoc } from '@/utils/exporters';
import { hasArabic } from '@/utils/text';

export const NOTE_WARNING = 'التوثيقات مولّدة آلياً من بيانات المصادر وقد تنقصها حقول (كرقم المجلد أو الصفحات). راجعها مع المصدر الأصلي قبل الاعتماد في عملك العلمي.';

export function buildBibliographyDoc(papers: Paper[], style: CitationStyle, notes?: Map<string, string>): ExportDoc {
  const sorted = sortForBibliography(papers);
  const label = CITATION_STYLES.find((s) => s.id === style)?.label ?? style;
  const rtl = sorted.filter((p) => hasArabic(p.title)).length >= sorted.length / 2;
  const sections: ExportDoc['sections'] = [{ heading: rtl ? 'قائمة المراجع' : 'References', refs: sorted.map((p) => formatCitation(p, style)) }];
  if (notes && [...notes.values()].some(Boolean)) {
    sections.push({ heading: rtl ? 'ملاحظاتي على المراجع' : 'My notes', paragraphs: sorted.filter((p) => notes.get(p.id)).map((p, i) => `${i + 1}. ${p.title}\n${notes.get(p.id)}`) });
  }
  return { title: rtl ? 'قائمة المراجع' : 'Reference list', subtitle: `${label} — ${sorted.length}`, rtl, sections, note: NOTE_WARNING };
}

