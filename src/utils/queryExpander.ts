import { BILINGUAL_TERMS, GENERIC_WORDS } from '@/data/dictionary';
import { hasArabic } from './text';

// ============================================================
// ترجمة استعلام البحث العربي إلى الإنجليزية بالقاموس المحلي (سريع ومجاني ودقيق للمصطلحات التربوية).
// المطابقة تتجاهل: التشكيل والتطويل، وتوحّد الهمزات (أإآ→ا) والياء/الألف المقصورة والتاء المربوطة،
// وتتجاوز «ال» التعريف وحروف الجر الملتصقة (و/ب/ل/ك/ف) فتطابق «وصعوبات التعلّم» و«للصم».
// ما لا يعرفه القاموس يُترجَم احتياطياً عبر الخادم (Gemini ثم MyMemory) — انظر services/translate.ts
// ============================================================

export function normalizeArabic(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // التشكيل والتطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s+]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// حذف «ال» وما يلتصق بها (وال/بال/كال/فال/لل) من بداية كل كلمة
const stripAl = (s: string): string => s.replace(/(^| )(?:وال|بال|كال|فال|لل|ال)/g, '$1');
const prep = (s: string): string => stripAl(normalizeArabic(s));
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Entry { key: string; en: string; re: RegExp }

// المصطلحات الأطول أولاً لتُطابَق العبارات المركبة قبل مفرداتها
const ENTRIES: Entry[] = Object.entries(BILINGUAL_TERMS)
  .map(([ar, en]) => ({ key: prep(ar), en }))
  .filter((e, i, all) => e.key && all.findIndex((x) => x.key === e.key) === i)
  .sort((a, b) => b.key.length - a.key.length)
  .map((e) => ({ ...e, re: new RegExp(`(^| )[وبلكف]?${escapeRe(e.key)}(?= |$)`) }));

const GENERIC = new Set([...GENERIC_WORDS].map(prep));

export interface ExpandedQuery {
  original: string;
  english: string; // ترجمة ما عرفه القاموس (فارغ إن لم يعرف شيئاً)
  hasArabic: boolean;
  complete: boolean; // هل غُطّي كل معنى الاستعلام؟ (إن لا: يُستحسن الترجمة الاحتياطية)
  unmatched: string[]; // كلمات عربية ذات معنى لم يعرفها القاموس
}

export function expandQuery(rawQuery: string): ExpandedQuery {
  const original = rawQuery.trim();
  if (!hasArabic(original)) return { original, english: original, hasArabic: false, complete: true, unmatched: [] };

  let rest = prep(original);
  const found: { at: number; en: string }[] = [];
  for (const e of ENTRIES) {
    const m = e.re.exec(rest);
    if (!m) continue;
    const lead = m[1].length;
    found.push({ at: m.index + lead, en: e.en });
    // نستبدل المطابَق بمسافات بنفس الطول فتبقى مواضع بقية الكلمات ثابتة (لنرتّب الإنجليزية بترتيب الاستعلام الأصلي)
    rest = rest.slice(0, m.index + lead) + ' '.repeat(m[0].length - lead) + rest.slice(m.index + m[0].length);
  }
  const unmatched: string[] = [];
  for (const m of rest.matchAll(/\S+/g)) {
    const w = m[0];
    if (/^[A-Za-z0-9+]+$/.test(w)) { found.push({ at: m.index ?? 0, en: w }); continue; } // رموز لاتينية داخل الاستعلام (ADHD, STEM...)
    if (w.length < 3 || GENERIC.has(w)) continue;
    unmatched.push(w);
  }
  const english = [...new Set(found.sort((x, y) => x.at - y.at).map((f) => f.en))].join(' ');
  return { original, english, hasArabic: true, complete: unmatched.length === 0, unmatched };
}

// الترجمة الإنجليزية المعتمدة للاستعلام: ما وصل من خدمة الترجمة أولاً، وإلا من القاموس المحلي
export function englishOf(query: string, englishQuery?: string): string {
  return englishQuery?.trim() || expandQuery(query).english;
}
