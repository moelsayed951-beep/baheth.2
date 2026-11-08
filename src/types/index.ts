// الأنواع الأساسية للمنصة
export type AcademicDomain = 'all' | 'education' | 'sharia';
export type ProxySourceId = 'pubmed' | 'base' | 'doaj' | 'arxiv' | 'europepmc' | 'zenodo' | 'hal' | 'core' | 'semanticscholar';
export type WebLibraryGroupId = 'web_arabic_db' | 'web_arabic_books' | 'web_egypt_repos' | 'web_global_pubs';
export type AcademicSourceId = 'openalex' | 'crossref' | 'eric' | 'semanticscholar' | 'core' | 'openaire' | ProxySourceId | WebLibraryGroupId;

// الصيغة الموحّدة لنتيجة أي مصدر (قبل تحويلها إلى Paper داخل normalizeData)
export interface UnifiedResearchResult {
  id: string;
  title: string;
  authors: string[];
  source: string; // اسم الموقع أو القاعدة (OpenAlex, Shamela, ...)
  year: string;
  type: 'thesis' | 'article' | 'book';
  abstract?: string;
  url: string;
  doi?: string;
  provider: 'api' | 'web-search';
  pdfUrl?: string;
  openAccess?: boolean;
  citationCount?: number;
  institution?: string; // الجهة/المستودع الحاضن (جامعة أو مستودع)
  venue?: string; // المجلة أو الدورية
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  countryCodes?: string[]; // رموز ISO للدول المتحقق منها من المصدر (مثل EG)
}
export type PublicationType = 'thesis_master' | 'thesis_phd' | 'thesis_other' | 'journal_article' | 'book';
export type TypeFilter = 'all' | 'thesis' | 'master' | 'phd' | 'article' | 'book';
export type SortKey = 'relevance' | 'year' | 'citations';

export interface Author {
  name: string;
  affiliation?: string;
}

export interface Paper {
  id: string;
  doi?: string;
  title: string;
  authors: Author[];
  year: number;
  abstract: string; // قد يكون فارغاً إذا لم يوفره المصدر
  publicationType: PublicationType;
  source: AcademicSourceId;
  sources: AcademicSourceId[]; // كل المصادر التي وُجدت فيها الورقة بعد إزالة التكرار
  institution?: string; // اسم الجهة كما ورد من المصدر
  venue?: string; // اسم المجلة/الدورية (للتوثيق)
  publisher?: string; // الناشر
  volume?: string;
  issue?: string;
  pages?: string;
  countryCodes?: string[]; // دول الجهات المؤلِّفة كما يحددها المصدر نفسه (لا تُستنتج من الاستعلام)
  universityId?: string; // معرف الجامعة المطابقة من قائمة الجامعات المصرية (إن وُجد)
  domain: AcademicDomain;
  pdfUrl?: string;
  isOpenAccess: boolean;
  citationCount: number;
  sourceUrl: string;
  provider?: 'api' | 'web-search'; // مصدر النتيجة: واجهة API أو بحث ويب (روابط ذكية)
  sourceLabel?: string; // اسم الموقع كما يُعرض (مثل: المكتبة الشاملة)
}

// الفلاتر المؤثرة على الجلب من الخوادم
export interface FilterOptions {
  query: string;
  domain: AcademicDomain;
  universities: string[];
  departments: string[];
  yearStart?: number;
  yearEnd?: number;
  isOpenAccessOnly: boolean;
  typeFilter: TypeFilter;
  egyptOnly: boolean;
  page?: number; // رقم الصفحة (يبدأ من 0) لتحميل المزيد من كل مصدر
  englishQuery?: string; // ترجمة إنجليزية للاستعلام (من القاموس أو خدمة الترجمة) لتوسيع البحث في المصادر العالمية
}

export type SourceStatus = 'ok' | 'error' | 'skipped';

export interface SourceIssue {
  kind: 'needs_key' | 'needs_login' | 'needs_ip' | 'quota' | 'no_translation' | 'network' | 'other';
  action?: { label: string; to: string }; // رابط إصلاح داخل المنصة (مثل صفحة مفاتيحي)
}

export interface SourceReport {
  id: AcademicSourceId;
  issue?: SourceIssue; // يوجد عند عدم توفر المصدر؛ يحدد طريقة عرضه (هادئ أو خطأ)
  kind?: 'api' | 'web-search';
  label: string;
  status: SourceStatus;
  count: number;
  message?: string;
}

export interface AggregateResult {
  papers: Paper[];
  reports: SourceReport[];
  englishQuery?: string; // الترجمة الإنجليزية المستخدمة في البحث (للترتيب)
}

// ناتج كل مصدر: الأوراق + ملاحظة اختيارية (مثل: تم تخفيف الفلاتر)
export interface SourceOutput {
  papers: Paper[];
  note?: string;
}
