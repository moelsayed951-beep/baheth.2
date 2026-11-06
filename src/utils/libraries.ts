// المكتبات المتاحة كفلاتر في بحث الويب. أضف مكتبة جديدة بسطر واحد هنا.
export interface LibraryPreset {
  host: string; // النطاق المستخدم في site:
  label: string;
  hint: string;
}

export const LIBRARY_PRESETS: LibraryPreset[] = [
  { host: 'shamela.ws', label: 'المكتبة الشاملة', hint: 'كتب التراث والعلوم الشرعية' },
  { host: 'noor-book.com', label: 'مكتبة نور', hint: 'كتب إلكترونية عامة ومتخصصة' },
  { host: 'archive.org', label: 'أرشيف الإنترنت', hint: 'كتب ومخطوطات ممسوحة ضوئياً' },
  { host: 'journals.ekb.eg', label: 'المجلات العلمية المصرية (بنك المعرفة)', hint: 'مجلات محكّمة، منها مجلات كليات جامعة الأزهر' },
  { host: 'azhar.edu.eg', label: 'موقع جامعة الأزهر', hint: 'الموقع الرسمي للجامعة وكلياتها' }
];

const HOST_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

// يحوّل ما يكتبه المستخدم (رابط أو نطاق) إلى نطاق نظيف، أو null إذا لم يكن صالحاً
export function normalizeHost(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
  s = s.split(/[/?#]/)[0] ?? '';
  return HOST_RE.test(s) ? s : null;
}

export function libraryLabel(host: string): string {
  const clean = host.replace(/^www\./, '');
  const hit = LIBRARY_PRESETS.find((p) => clean === p.host || clean.endsWith(`.${p.host}`));
  return hit ? hit.label : clean;
}

export const MAX_SITES = 5;
