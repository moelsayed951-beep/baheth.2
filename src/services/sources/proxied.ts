// مصادر عالمية عبر وسيط Cloudflare (PubMed / BASE / DOAJ / arXiv) + مكتبات عربية عبر بحث الويب.
import type { FilterOptions, Paper, ProxySourceId, UnifiedResearchResult, WebLibraryGroupId } from '@/types';
import { callProxy, ProxyError } from '@/utils/proxy';
import { englishOf } from '@/utils/queryExpander';
import { normalizeData } from '../normalize';
import { searchWeb } from '../googleSearchService';
import { SourceSkipped } from '../errors';
import { classifyFailure } from '../sourceIssues';
import { getKey, type KeyId } from '@/utils/userKeys';

// مصادر تفهم الإنجليزية أفضل → نستخدم ترجمة الاستعلام؛ وBASE وCORE وDOAJ وZenodo وHAL تدعم العربية مباشرة
const NEEDS_ENGLISH: Record<ProxySourceId, boolean> = { pubmed: true, arxiv: true, europepmc: true, semanticscholar: true, doaj: false, base: false, zenodo: false, hal: false, core: false };

// مفاتيح المستخدم الخاصة لهذه المصادر تُرسل في ترويسة طلب واحد إلى وسيط Cloudflare (لا تُرسل لأي جهة أخرى)
const KEY_OF: Partial<Record<ProxySourceId, { header: string; id: KeyId; label: string }>> = {
  core: { header: 'X-User-Core-Key', id: 'core', label: 'CORE' },
  semanticscholar: { header: 'X-User-S2-Key', id: 's2', label: 'Semantic Scholar' }
};

// مصادر تعذّرت لسبب لا يتغير خلال الجلسة (تسجيل IP لدى BASE، رفض Zenodo، غياب مفتاح CORE): لا نكرر الطلب مع كل صفحة بل نتخطاها بهدوء
const parked = new Map<string, SourceSkipped>();
const PARKABLE: ProxySourceId[] = ['base', 'zenodo', 'core'];
export const _resetParkedForTests = (): void => parked.clear();

export async function searchProxied(src: ProxySourceId, filters: FilterOptions, signal?: AbortSignal): Promise<Paper[]> {
  const keyInfo = KEY_OF[src];
  const userKey = keyInfo ? getKey(keyInfo.id) : undefined;
  const held = parked.get(src);
  if (held && !userKey) throw held; // إن أضاف المستخدم مفتاحه نعيد المحاولة

  let q = filters.query.trim();
  if (NEEDS_ENGLISH[src]) {
    const english = englishOf(filters.query, filters.englishQuery);
    if (!english) throw new SourceSkipped('تعذّرت ترجمة الاستعلام للإنجليزية فتُخطّي هذا المصدر', 'no_translation');
    q = english;
  }
  let path = `/api/proxy/source?src=${src}&q=${encodeURIComponent(q)}&page=${filters.page ?? 0}`;
  if (src === 'semanticscholar') path += `&ys=${filters.yearStart ?? ''}&ye=${filters.yearEnd ?? ''}`;

  try {
    const data = await callProxy<{ results: UnifiedResearchResult[] }>(path, { signal, timeoutMs: 18000, headers: keyInfo && userKey ? { [keyInfo.header]: userKey } : undefined });
    parked.delete(src);
    return normalizeData(data.results, src, filters.domain);
  } catch (e) {
    if (e instanceof ProxyError) {
      // بيئة التطوير بدون دوال Cloudflare: نتخطى بدل إظهار خطأ
      if (e.status === 404) throw new SourceSkipped(e.message);
      const c = classifyFailure(src, e);
      if (c.status === 'skipped' && ['needs_key', 'needs_ip', 'needs_login'].includes(c.issue.kind)) {
        // لدى المستخدم مفتاح لكن المصدر رفضه/بلغ حدّه: رسالة مختلفة ولا نوقف المصدر
        if (userKey && keyInfo) throw new SourceSkipped(`${keyInfo.label} رفض مفتاحك أو بلغ حدّه: تحقق منه في «مفاتيحي» أو جرّب لاحقاً`, 'quota');
        const skip = new SourceSkipped(c.message, c.issue.kind);
        if (PARKABLE.includes(src)) parked.set(src, skip);
        throw skip;
      }
    }
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
