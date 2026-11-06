import type { AcademicDomain } from '@/types';

export interface DeepLink {
  id: string;
  label: string;
  url: string;
}

// روابط بحث ذكية للمنصات العربية/المصرية التي لا توفر API مجاني.
// الروابط تعتمد على بنية صفحات البحث لديهم وقد تتغير؛ راجعها دورياً.
export function buildDeepLinks(keyword: string, domain: AcademicDomain): DeepLink[] {
  const enc = encodeURIComponent(keyword.trim());
  const db = domain === 'sharia' ? 'IslamicInfo' : 'EduSearch';
  return [
    { id: 'mandumah', label: 'دار المنظومة', url: `https://search.mandumah.com/Search/Results?lookfor=${enc}&db=${db}` },
    { id: 'ekb', label: 'بنك المعرفة المصري', url: `https://www.ekb.eg/ar/web/guest/search#search_term=${enc}` },
    { id: 'almanhal', label: 'المنهل', url: `https://platform.almanhal.com/Search/Result?q=${enc}` },
    { id: 'gbooks', label: 'كتب Google', url: `https://www.google.com/search?tbm=bks&q=${enc}` },
    { id: 'scholar', label: 'Google Scholar', url: `https://scholar.google.com/scholar?q=${enc}` }
  ];
}
