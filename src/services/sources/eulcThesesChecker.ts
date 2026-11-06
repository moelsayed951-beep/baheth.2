import { aggregateAllSources } from '../aggregator';
import { normalizeText } from '@/utils/text';
import type { AcademicDomain, Paper } from '@/types';

export interface SimilarTitle {
  paper: Paper;
  similarity: number; // نسبة من 0 إلى 100
}

// كلمات شائعة لا تدل على التشابه الموضوعي
const STOP = new Set(['في', 'من', 'على', 'الى', 'عن', 'مع', 'بين', 'دراسه', 'بحث', 'فاعليه', 'اثر', 'نحو', 'for', 'the', 'and', 'of', 'in', 'on', 'a', 'an', 'to']);

function tokens(s: string): Set<string> {
  return new Set(
    normalizeText(s)
      .split(' ')
      .map((w) => w.replace(/^ال/, ''))
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

// تشابه جاكارد بين مجموعتي كلمات
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((w) => { if (b.has(w)) inter++; });
  return inter / (a.size + b.size - inter);
}

// يبحث عن عناوين منشورة قريبة من العنوان المقترح.
// تنبيه: هذا فحص استرشادي من المصادر المفتوحة وليس بديلاً عن إفادة الجامعة/EULC الرسمية.
export async function findSimilarTitles(topic: string, domain: AcademicDomain): Promise<SimilarTitle[]> {
  const result = await aggregateAllSources({
    query: topic,
    domain,
    universities: [],
    departments: [],
    isOpenAccessOnly: false,
    typeFilter: 'all',
    egyptOnly: false
  }, undefined, { includeWeb: false });
  const mine = tokens(topic);
  return result.papers
    .map((paper) => ({ paper, similarity: Math.round(jaccard(mine, tokens(paper.title)) * 100) }))
    .filter((s) => s.similarity >= 15)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
}

export interface OfficialCatalog {
  name: string;
  desc: string;
  url: string;
}

// روابط الفهارس الرسمية للتحقق اليدوي (قد تتغير روابطها، فيُنصح بمراجعتها)
export function getOfficialCatalogs(topic: string): OfficialCatalog[] {
  const enc = encodeURIComponent(topic.trim());
  return [
    {
      name: 'اتحاد مكتبات الجامعات المصرية (EULC)',
      desc: 'فهرس الرسائل الجامعية المصرية',
      url: `http://main.eulc.edu.eg/eulc_v5/Libraries/start.aspx?fn=DrawSearch&SearchBy=KeyWords&Word=${enc}`
    },
    {
      name: 'دار المنظومة (EduSearch / IslamicInfo)',
      desc: 'فهرس عربي للرسائل والأبحاث المحكمة',
      url: `https://search.mandumah.com/Search/Results?lookfor=${enc}`
    },
    {
      name: 'بنك المعرفة المصري',
      desc: 'بحث في المصادر المتاحة عبر بنك المعرفة المصري',
      url: `https://www.ekb.eg/ar/web/guest/search#search_term=${enc}`
    },
    {
      name: 'مستودع جامعة القاهرة الرقمي',
      desc: 'أرشيف الرسائل والأبحاث بجامعة القاهرة',
      url: 'https://dspace.cu.edu.eg/'
    }
  ];
}
