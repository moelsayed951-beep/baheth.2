import { hasArabic } from './text';

// قاموس المصطلحات ثنائي اللغة: يترجم مصطلحات البحث العربية لإنجليزية
// لأن ERIC وجزءاً كبيراً من OpenAlex يفهمان الإنجليزية أفضل
const BILINGUAL_TERMS: Record<string, string> = {
  // مصطلحات تربوية
  'التربية الخاصة': 'Special Education',
  'صعوبات التعلم': 'Learning Disabilities',
  'المناهج وطرق التدريس': 'Curriculum and Instruction',
  'المناهج': 'Curriculum',
  'طرق التدريس': 'Teaching Methods',
  'استراتيجيات التدريس': 'Teaching Strategies',
  'أصول التربية': 'Foundations of Education',
  'علم النفس التربوي': 'Educational Psychology',
  'الصحة النفسية': 'Mental Health',
  'تكنولوجيا التعليم': 'Educational Technology',
  'التعليم الإلكتروني': 'E-Learning',
  'التعلم الإلكتروني': 'E-Learning',
  'الذكاء الاصطناعي': 'Artificial Intelligence',
  'الإدارة المدرسية': 'School Administration',
  'الإدارة التعليمية': 'Educational Administration',
  'التفكير الابتكاري': 'Creative Thinking',
  'التفكير الناقد': 'Critical Thinking',
  'التحصيل الدراسي': 'Academic Achievement',
  'التحصيل': 'Academic Achievement',
  'الذكاء الوجداني': 'Emotional Intelligence',
  'التوحد': 'Autism Spectrum',
  'الموهوبين': 'Gifted and Talented',
  'رياض الأطفال': 'Kindergarten',
  'المعلم': 'Teacher',
  'الطلاب': 'Students',
  'فاعلية': 'Effectiveness',
  'التنمية المستدامة': 'Sustainable Development',

  // مصطلحات شرعية
  'الفقه الإسلامي': 'Islamic Jurisprudence',
  'الفقه': 'Fiqh Islamic Jurisprudence',
  'مقاصد الشريعة': 'Maqasid Objectives of Islamic Law',
  'المصارف الإسلامية': 'Islamic Banking and Finance',
  'التمويل الإسلامي': 'Islamic Finance',
  'أصول الفقه': 'Usul al-Fiqh Principles of Islamic Jurisprudence',
  'القواعد الفقهية': 'Legal Maxims Islamic Law',
  'الحديث النبوي': 'Prophetic Hadith Studies',
  'الحديث': 'Hadith',
  'علوم القرآن': 'Quranic Sciences',
  'التفسير': 'Quran Exegesis Tafsir',
  'الفلسفة الإسلامية': 'Islamic Philosophy',
  'العقيدة': 'Islamic Theology Aqeedah',
  'الدعوة': 'Dawah Islamic Outreach',
  'الزكاة': 'Zakat',
  'الصكوك': 'Sukuk',
  'السياسة الشرعية': 'Islamic Political Jurisprudence Siyasa Shariyya',
  'النوازل': 'Contemporary Islamic Legal Issues'
};

// إزالة "ال" التعريف من الكلمات لتحسين المطابقة (التربية ← تربية)
function loose(s: string): string {
  return s.replace(/(^|\s)ال/g, '$1');
}

// المصطلحات الأطول أولاً لضمان مطابقة العبارات المركبة قبل الكلمات المفردة
const SORTED_TERMS: [string, string][] = Object.entries(BILINGUAL_TERMS)
  .map(([ar, en]): [string, string] => [loose(ar), en])
  .sort((a, b) => b[0].length - a[0].length);

export interface ExpandedQuery {
  original: string;
  english: string; // ترجمة المصطلحات المعروفة (فارغ إن لم يوجد)
  hasArabic: boolean;
}

export function expandQuery(rawQuery: string): ExpandedQuery {
  const original = rawQuery.trim();
  if (!hasArabic(original)) {
    // الاستعلام إنجليزي أصلاً
    return { original, english: original, hasArabic: false };
  }

  let remaining = loose(original);
  const found: string[] = [];
  for (const [key, en] of SORTED_TERMS) {
    if (remaining.includes(key)) {
      found.push(en);
      remaining = remaining.replace(key, ' ');
    }
  }
  return { original, english: [...new Set(found)].join(' '), hasArabic: true };
}

// الترجمة الإنجليزية المعتمدة للاستعلام: ما وصل من خدمة الترجمة أولاً، وإلا من القاموس المحلي
export function englishOf(query: string, englishQuery?: string): string {
  return englishQuery?.trim() || expandQuery(query).english;
}
