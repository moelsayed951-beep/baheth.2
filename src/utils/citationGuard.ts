// ============================================================
// حارس الاستشهادات: يفحص ما كتبه النموذج مقابل المراجع التي اختارها الباحث فعلاً.
// هو فحص آلي جزئي لكشف الاختلاق الظاهر؛ لا يغني عن مراجعة الباحث.
// ============================================================
import type { Paper } from '@/types';
import { normalizeText } from '@/utils/text';

export interface GuardReport {
  usedRefs: number[]; // أرقام المراجع التي أُحيل إليها فعلاً
  invalidRefs: number[]; // إحالات برقم غير موجود في قائمتك
  suspiciousCitations: string[]; // (اسم، سنة) لا يطابق أي مرجع من قائمتك
  foreignDois: string[];
  foreignUrls: string[];
  pageNumbers: string[]; // أرقام صفحات لم ترد في بياناتك
  needsSource: number; // عدد علامات [بحاجة إلى مصدر]
  ok: boolean; // لا إحالات غير صالحة ولا مصادر دخيلة
}

const NUM_GROUP = /\[\s*(\d{1,3}(?:\s*[,،\-–]\s*\d{1,3})*)\s*\]/g;

function expand(group: string): number[] {
  const out: number[] = [];
  for (const part of group.split(/[,،]/)) {
    const m = part.trim().match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
    if (m) { for (let i = Number(m[1]); i <= Number(m[2]) && i - Number(m[1]) < 50; i++) out.push(i); }
    else if (/^\d{1,3}$/.test(part.trim())) out.push(Number(part.trim()));
  }
  return out;
}

const tidyUrl = (u: string): string => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[/.,;:)\]]+$/, '');

export function auditOutput(text: string, refs: Paper[]): GuardReport {
  const used = new Set<number>();
  const invalid = new Set<number>();
  for (const m of text.matchAll(NUM_GROUP)) {
    for (const n of expand(m[1])) { if (n >= 1 && n <= refs.length) used.add(n); else invalid.add(n); }
  }

  // (المؤلف، 2019) أو (Smith, 2019) أو (Smith & Lee, 2019): مرفوض ما لم يطابق مرجعاً من القائمة
  const suspicious: string[] = [];
  for (const m of text.matchAll(/\(([^()\n]{2,90}?)[,،]\s*((?:19|20)\d{2})[a-z]?\)/g)) {
    const who = normalizeText(m[1]);
    const year = Number(m[2]);
    const matched = refs.some((r) => r.year === year && r.authors.some((a) => a.name.split(/\s+/).some((tok) => normalizeText(tok).length >= 3 && who.includes(normalizeText(tok)))));
    if (!matched) suspicious.push(m[0]);
  }

  const knownDois = new Set(refs.map((r) => r.doi?.toLowerCase()).filter(Boolean) as string[]);
  const foreignDois = [...new Set((text.match(/10\.\d{4,9}\/[^\s"<>)\]]+/gi) ?? []).map((d) => d.replace(/[.,;:]+$/, '').toLowerCase()))].filter((d) => !knownDois.has(d));

  const knownUrls = new Set(refs.flatMap((r) => [r.sourceUrl, r.pdfUrl, r.doi ? `https://doi.org/${r.doi}` : undefined]).filter(Boolean).map((u) => tidyUrl(u as string)));
  const foreignUrls = [...new Set((text.match(/https?:\/\/[^\s"<>)\]]+/gi) ?? []))].filter((u) => !knownUrls.has(tidyUrl(u)) && !/^10\./.test(tidyUrl(u)) && !knownDois.has(tidyUrl(u).replace(/^doi\.org\//, '')));

  const pageNumbers = [...new Set(text.match(/(?:\bpp?\.\s*\d+(?:\s*[-–]\s*\d+)?|ص(?:فحة|\.)?\s*\d+(?:\s*[-–]\s*\d+)?)/gi) ?? [])];
  const needsSource = (text.match(/\[\s*بحاجة إلى مصدر\s*\]/g) ?? []).length;

  return {
    usedRefs: [...used].sort((a, b) => a - b),
    invalidRefs: [...invalid].sort((a, b) => a - b),
    suspiciousCitations: [...new Set(suspicious)],
    foreignDois,
    foreignUrls,
    pageNumbers,
    needsSource,
    ok: invalid.size === 0 && suspicious.length === 0 && foreignDois.length === 0 && foreignUrls.length === 0
  };
}

// تحويل مخرجات Markdown الشائعة إلى نص عادي صالح للتصدير
export function plainifyMarkdown(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '• ')
    .replace(/`+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
