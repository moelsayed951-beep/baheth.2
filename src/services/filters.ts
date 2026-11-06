// ============================================================
// فلاتر دقيقة على النتائج بعد جلبها — لا تعتمد على تلميحات في نص الاستعلام.
// ============================================================
import { ALL_DEPARTMENTS } from '@/data/departments';
import type { FilterOptions, Paper } from '@/types';
import { matchesTypeFilter, normalizeText } from '@/utils/text';

/* ---- السنة: عند تحديد نطاق سنوات نستبعد ما سنته مجهولة (لا نفترض أنه مطابق) ---- */
export function passesYear(p: Paper, from?: number, to?: number): boolean {
  if (!from && !to) return true;
  if (!p.year) return false;
  if (from && p.year < from) return false;
  if (to && p.year > to) return false;
  return true;
}

/* ---- القسم: يجب أن يطابق العنوان أو الملخص مصطلحاً من القسم المختار (عربياً أو إنجليزياً) ---- */
const stripAl = (w: string) => w.replace(/^ال/, '');

export function departmentTerms(ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const d = ALL_DEPARTMENTS.find((x) => x.id === id);
    if (!d) continue;
    for (const k of [...d.keywords, ...d.keywordsEn]) {
      const n = normalizeText(k);
      if (n.length >= 3) { out.add(n); out.add(stripAl(n)); }
    }
  }
  return [...out].filter((t) => t.length >= 3);
}

export function matchesDepartments(p: Paper, ids: string[], terms = departmentTerms(ids)): boolean {
  if (!ids.length) return true;
  if (!terms.length) return true;
  const text = normalizeText(`${p.title} ${p.abstract}`);
  return terms.some((t) => text.includes(t));
}

/* ---- مصر: لا نقبل إلا ما أمكن التحقق من جهته (دولة من المصدر، أو جامعة مصرية معروفة، أو نطاق .eg) ---- */
const hostOf = (u?: string): string => {
  try { return u ? new URL(u).hostname.toLowerCase() : ''; } catch { return ''; }
};

export function isVerifiedEgyptian(p: Paper): boolean {
  if (p.countryCodes?.some((c) => c.toUpperCase() === 'EG')) return true;
  if (p.universityId) return true;
  if (hostOf(p.sourceUrl).endsWith('.eg') || hostOf(p.pdfUrl).endsWith('.eg')) return true;
  return /\b(egypt|egyptian)\b|مصر|المصري/i.test(p.institution ?? '');
}

/* ---- التجميع ---- */
export interface FilterStats { hiddenUnknownYear: number; hiddenOffDepartment: number; hiddenUnverifiedEgypt: number }

export function applyFilters(papers: Paper[], f: FilterOptions): { papers: Paper[]; stats: FilterStats } {
  const stats: FilterStats = { hiddenUnknownYear: 0, hiddenOffDepartment: 0, hiddenUnverifiedEgypt: 0 };
  const terms = departmentTerms(f.departments);
  const out = papers.filter((p) => {
    if (!passesYear(p, f.yearStart, f.yearEnd)) { if (!p.year) stats.hiddenUnknownYear++; return false; }
    if (f.isOpenAccessOnly && !p.isOpenAccess) return false;
    if (!matchesTypeFilter(p.publicationType, f.typeFilter)) return false;
    if (f.universities.length && (!p.universityId || !f.universities.includes(p.universityId))) return false;
    if (f.departments.length && !matchesDepartments(p, f.departments, terms)) { stats.hiddenOffDepartment++; return false; }
    if (f.egyptOnly && !isVerifiedEgyptian(p)) { stats.hiddenUnverifiedEgypt++; return false; }
    return true;
  });
  return { papers: out, stats };
}
