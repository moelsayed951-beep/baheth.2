// مصادر عالمية عبر وسيط Cloudflare (PubMed / BASE / DOAJ / arXiv) + مكتبات عربية عبر بحث الويب.
import type { FilterOptions, Paper, ProxySourceId, UnifiedResearchResult, WebLibraryGroupId } from '@/types';
import { callProxy, ProxyError } from '@/utils/proxy';
import { englishOf } from '@/utils/queryExpander';
import { normalizeData } from '../normalize';
import { searchWeb } from '../googleSearchService';
import { SourceSkipped } from '../errors';

// PubMed و arXiv و DOAJ إنجليزية في الغالب → نستخدم الترجمة المعروفة؛ BASE يدعم العربية مباشرة
const NEEDS_ENGLISH: Record<ProxySourceId, boolean> = { pubmed: true, arxiv: true, europepmc: true, doaj: false, base: false, zenodo: false, hal: false, core: false };

export async function searchProxied(src: ProxySourceId, filters: FilterOptions, signal?: AbortSignal): Promise<Paper[]> {
  let q = filters.query.trim();
  if (NEEDS_ENGLISH[src]) {
    const english = englishOf(filters.query, filters.englishQuery);
    if (!english) throw new SourceSkipped('لا توجد ترجمة إنجليزية معروفة للاستعلام');
    q = english;
  }
  try {
    const data = await callProxy<{ results: UnifiedResearchResult[] }>(`/api/proxy/source?src=${src}&q=${encodeURIComponent(q)}&page=${filters.page ?? 0}`, { signal, timeoutMs: 18000 });
    return normalizeData(data.results, src, filters.domain);
  } catch (e) {
    // بيئة التطوير بدون دوال Cloudflare: نتخطى بدل إظهار خطأ
    if (e instanceof ProxyError && (e.status === 404 || e.code === 'not_configured')) throw new SourceSkipped(e.message);
    throw e;
  }
}

/* ---- المكتبات العربية والمحلية: لا APIs، فنبحث داخل نطاقاتها (site:) عبر محرك الويب المفعّل ---- */
export interface WebLibraryGroup { id: WebLibraryGroupId; label: string; sites: string[]; type: UnifiedResearchResult['type'] }

export const WEB_LIBRARY_GROUPS: WebLibraryGroup[] = [
  { id: 'web_arabic_db', label: 'دار المنظومة · المنهل · المعرفة', sites: ['mandumah.com', 'almanhal.com', 'e-marefa.net'], type: 'article' },
  { id: 'web_arabic_books', label: 'الشاملة · نور · بنك المعرفة', sites: ['shamela.ws', 'noor-book.com', 'ekb.eg'], type: 'book' },
  { id: 'web_egypt_repos', label: 'مستودعات الجامعات المصرية', sites: ['edu.eg'], type: 'thesis' },
  { id: 'web_global_pubs', label: 'JSTOR · IEEE · Springer', sites: ['jstor.org', 'ieeexplore.ieee.org', 'link.springer.com'], type: 'article' }
];

const SITE_NAMES: Record<string, string> = {
  'mandumah.com': 'دار المنظومة', 'almanhal.com': 'المنهل', 'e-marefa.net': 'المعرفة', 'shamela.ws': 'المكتبة الشاملة',
  'noor-book.com': 'مكتبة نور', 'ekb.eg': 'بنك المعرفة المصري', 'jstor.org': 'JSTOR', 'ieeexplore.ieee.org': 'IEEE', 'link.springer.com': 'Springer'
};

function siteName(url: string, fallback: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const hit = Object.keys(SITE_NAMES).find((h) => host === h || host.endsWith(`.${h}`));
    if (hit) return SITE_NAMES[hit];
    if (host.endsWith('.edu.eg')) return `مستودع ${host}`;
    return host || fallback;
  } catch {
    return fallback;
  }
}

export async function searchWebLibraries(group: WebLibraryGroup, filters: FilterOptions, signal?: AbortSignal): Promise<Paper[]> {
  // بحث الويب محدود العمق (حصة المزوّد المجانية): الصفحة الأولى فقط؛ التعمّق يكون عبر بقية المصادر
  if ((filters.page ?? 0) > 0) return [];
  try {
    // مستودعات الجامعات: نضيف كلمة تساعد على استهداف الرسائل
    const query = group.id === 'web_egypt_repos' ? `${filters.query} رسالة ماجستير دكتوراه` : filters.query;
    const page = await searchWeb({ query, sites: group.sites, signal });
    const items: UnifiedResearchResult[] = page.results.map((r) => ({
      id: `web-${r.url}`,
      title: r.title,
      authors: [],
      source: siteName(r.url, group.label),
      year: /\b(19|20)\d{2}\b/.exec(r.snippet)?.[0] ?? '',
      type: group.type,
      abstract: r.snippet,
      url: r.url,
      provider: 'web-search'
    }));
    return normalizeData(items, group.id, filters.domain);
  } catch (e) {
    if (e instanceof ProxyError && e.code === 'login_required') throw new SourceSkipped('سجّل الدخول بحساب Google لتفعيل بحث المكتبات العربية (أو أضف مفتاح Tavily الخاص بك)');
    if (e instanceof ProxyError && e.code === 'daily_quota') throw new SourceSkipped('انتهت حصتك اليومية للمكتبات العربية، تتجدد غداً');
    if (e instanceof ProxyError && (e.status === 404 || e.code === 'not_configured')) {
      throw new SourceSkipped('فعّل مزوّد بحث الويب (Tavily/Serper/...) لتشغيل هذه المكتبات');
    }
    throw e;
  }
}
