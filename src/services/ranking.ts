// ============================================================
// ترتيب موحّد للصلة عبر كل المصادر (بدل التناوب بين المصادر):
//  - نص: تطابق مصطلحات الاستعلام مع العنوان (وزن 3) والملخص (وزن 1) بوزن IDF محسوب على النتائج نفسها
//  - تغطية: نسبة مصطلحات الاستعلام الموجودة (بحث «AND» ناعم)
//  - عبارة كاملة: مكافأة إن ورد الاستعلام كما هو في العنوان
//  - جودة: الاستشهادات (لوغاريتمي)، الحداثة، الإتاحة المفتوحة، تعدد المصادر
// ============================================================
import type { Paper } from '@/types';
import { normalizeText } from '@/utils/text';

const STOP = new Set(['في', 'من', 'على', 'الى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'او', 'و', 'ان', 'ما', 'كان', 'بين', 'حول', 'the', 'of', 'and', 'in', 'on', 'for', 'to', 'a', 'an', 'with', 'by', 'from', 'at', 'is', 'are', 'as', 'its', 'their']);

export function stem(w: string): string {
  if (/^[a-z0-9]+$/.test(w)) return w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
  let s = w.replace(/^(وال|بال|كال|فال|لل|ال)/, '');
  if (s.length > 4) s = s.replace(/^[وبلف]/, '');
  return s.replace(/(ات|ون|ين|ان)$/, (m) => (s.length > 5 ? '' : m));
}

export function tokenize(text: string): string[] {
  return normalizeText(text).split(' ').filter((w) => w.length > 1 && !STOP.has(w)).map(stem).filter((w) => w.length > 1);
}

interface Doc { p: Paper; title: Set<string>; abs: Map<string, number>; nTitle: string }

export function rankPapers(papers: Paper[], query: string, englishQuery?: string): Paper[] {
  if (papers.length < 2) return papers;
  const qSets = [query, englishQuery ?? ''].map((q) => ({ norm: normalizeText(q), terms: [...new Set(tokenize(q))] })).filter((q) => q.terms.length > 0);
  if (!qSets.length) return papers;

  const docs: Doc[] = papers.map((p) => {
    const abs = new Map<string, number>();
    for (const t of tokenize(p.abstract)) abs.set(t, (abs.get(t) ?? 0) + 1);
    return { p, title: new Set(tokenize(p.title)), abs, nTitle: normalizeText(p.title) };
  });
  const N = docs.length;
  const df = new Map<string, number>();
  const allTerms = new Set(qSets.flatMap((q) => q.terms));
  for (const t of allTerms) df.set(t, docs.filter((d) => d.title.has(t) || d.abs.has(t)).length);
  const idf = (t: string) => Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));

  const maxCit = Math.max(1, ...papers.map((p) => p.citationCount));
  const nowY = new Date().getFullYear();

  const scored = docs.map((d, i) => {
    let best = 0;
    for (const q of qSets) {
      let num = 0, den = 0, hit = 0;
      for (const t of q.terms) {
        const w = idf(t);
        const inT = d.title.has(t) ? 1 : 0;
        const c = d.abs.get(t) ?? 0;
        const inA = c ? 1 - 1 / (1 + c) : 0;
        num += w * (3 * inT + inA);
        den += w * 4;
        if (inT || c) hit++;
      }
      const coverage = hit / q.terms.length;
      let s = (den ? num / den : 0) * (0.4 + 0.6 * coverage);
      if (q.norm && q.norm.length > 3 && d.nTitle.includes(q.norm)) s += 0.2;
      else if (q.norm && q.norm.length > 3 && normalizeText(d.p.abstract).includes(q.norm)) s += 0.06;
      best = Math.max(best, s);
    }
    const quality =
      0.12 * (Math.log1p(d.p.citationCount) / Math.log1p(maxCit)) +
      0.05 * (d.p.year ? Math.min(1, Math.max(0, (d.p.year - 1990) / (nowY - 1990))) : 0) +
      0.02 * (d.p.isOpenAccess ? 1 : 0) +
      0.04 * (Math.min(Math.max(d.p.sources.length - 1, 0), 3) / 3);
    // بحث بلا أي تطابق نصي مع الاستعلام لا يتقدم على بحث متطابق مهما كثرت استشهاداته
    return { p: d.p, score: best > 0 ? best + quality : quality * 0.01, i };
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((s) => s.p);
}
