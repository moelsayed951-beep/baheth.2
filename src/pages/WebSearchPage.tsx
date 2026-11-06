import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { searchWeb } from '@/services/googleSearchService';
import { useBackendStatus } from '@/hooks/useBackendStatus';
import { EmptyState } from '@/components/Search/EmptyState';
import { AzharScopeFilter } from '@/components/Search/AzharScopeFilter';
import { LibraryFilter } from '@/components/Search/LibraryFilter';
import { ResultSkeleton } from '@/components/Search/ResultSkeleton';
import { WebResultCard } from '@/components/Search/WebResultCard';
import type { WebResult } from '@/types/web';
import { buildScopedQuery } from '@/utils/azhar';
import { MAX_SITES, libraryLabel, normalizeHost } from '@/utils/libraries';
import { cn } from '@/utils/cn';

const PROVIDER_NAMES: Record<string, string> = { google: 'Google', serper: 'Google (عبر Serper)', serpapi: 'Google (عبر SerpApi)', tavily: 'Tavily', brave: 'Brave Search' };

// الحالة كلها في الرابط (q, sites) لتكون قابلة للمشاركة وتعمل مع زر الرجوع
function parseSites(raw: string | null): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const h = normalizeHost(part);
    if (h && !out.includes(h)) out.push(h);
  }
  return out.slice(0, MAX_SITES);
}

export const WebSearchPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const sitesKey = params.get('sites') ?? '';
  const sites = useMemo(() => parseSites(sitesKey), [sitesKey]);

  const azhar = params.get('faculty') === 'azhar';
  const deptId = azhar ? params.get('dept') ?? '' : '';
  const scopedQuery = useMemo(() => buildScopedQuery(query, azhar, deptId), [query, azhar, deptId]);

  const [inputVal, setInputVal] = useState(query);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => setInputVal(query), [query]);

  const { loaded, searchProvider } = useBackendStatus();

  const search = useInfiniteQuery({
    queryKey: ['web-search', scopedQuery, sites.join(',')],
    queryFn: ({ pageParam, signal }) => searchWeb({ query: scopedQuery, sites, start: pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextStart ?? undefined,
    enabled: query.length > 0 && loaded && searchProvider !== null,
    staleTime: 10 * 60 * 1000,
    retry: 0
  });

  const results = useMemo<WebResult[]>(() => {
    const seen = new Set<string>();
    const out: WebResult[] = [];
    for (const page of search.data?.pages ?? []) {
      for (const r of page.results) {
        if (!seen.has(r.url)) { seen.add(r.url); out.push(r); }
      }
    }
    return out;
  }, [search.data]);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) update({ q: inputVal.trim() });
  };

  const notConfigured = loaded && searchProvider === null;
  const loading = search.isLoading || (query.length > 0 && !loaded);
  const firstPageError = search.isError && results.length === 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex-1 w-full">
      <form onSubmit={onSearch} className="mb-5 flex flex-col sm:flex-row gap-2">
        <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} aria-label="كلمات البحث" placeholder="ابحث عن كتاب أو موضوع أو موقع..." className="field flex-1" />
        <button type="submit" className="btn-primary"><Search className="w-4 h-4" />بحث</button>
      </form>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 shrink-0">
          <button onClick={() => setShowFilters((v) => !v)} className="lg:hidden btn-ghost w-full !py-2.5 mb-3" aria-expanded={showFilters}>
            <SlidersHorizontal className="w-4 h-4" />
            المكتبات والنطاق{(sites.length > 0 || azhar) && ` (${sites.length + (azhar ? 1 : 0)})`}
          </button>
          <div className={cn('card p-4', showFilters ? 'block' : 'hidden lg:block')}>
            <LibraryFilter sites={sites} onChange={(s) => update({ sites: s.length ? s.join(',') : undefined })} />
            <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
              <AzharScopeFilter
                enabled={azhar}
                deptId={deptId}
                onChange={(p) => update({ ...('enabled' in p ? { faculty: p.enabled ? 'azhar' : undefined } : {}), ...('deptId' in p ? { dept: p.deptId || undefined } : {}) })}
              />
            </div>
          </div>
        </aside>

        <section className="flex-1 min-w-0 flex flex-col gap-4" aria-live="polite">
          {!query && (
            <EmptyState title="ابحث في الكتب والمواقع" hint="اكتب اسم كتاب أو موضوعاً، واختر المكتبة من القائمة الجانبية (الشاملة، نور، ...) أو اتركها فارغة للبحث في الويب كله." />
          )}

          {query && notConfigured && (
            <div className="card p-6 flex flex-col items-center text-center gap-2 border-amber-300 dark:border-amber-800">
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-stone-900 dark:text-stone-100">بحث الويب غير مفعّل بعد</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md leading-relaxed">
                لم يُضف مفتاح محرك البحث على الخادم، أو أنك تشغّل الموقع محلياً دون دوال Cloudflare. يمكنك إضافة مفتاح Tavily المجاني الخاص بك من صفحة «مفاتيحي». البحث الأكاديمي يعمل بشكل طبيعي من التبويب الأول.
              </p>
            </div>
          )}

          {query && !notConfigured && loading && (
            <>
              <p className="text-xs text-stone-500 dark:text-stone-400" role="status">جاري البحث...</p>
              {Array.from({ length: 4 }).map((_, i) => <ResultSkeleton key={i} />)}
            </>
          )}

          {query && !notConfigured && !loading && firstPageError && (
            <div className="card p-6 flex flex-col items-center text-center gap-3 border-red-200 dark:border-red-900">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              <h3 className="font-bold text-stone-900 dark:text-stone-100">تعذر جلب النتائج</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">{search.error instanceof Error ? search.error.message : 'حدث خطأ غير متوقع'}</p>
              <button onClick={() => void search.refetch()} className="btn-primary"><RefreshCw className="w-4 h-4" />إعادة المحاولة</button>
            </div>
          )}

          {query && !notConfigured && !loading && !firstPageError && search.data && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600 dark:text-stone-300">
                <span><strong>{results.length}</strong> نتيجة معروضة</span>
                {searchProvider && <span className="text-xs text-stone-500 dark:text-stone-400">عبر {PROVIDER_NAMES[searchProvider] ?? searchProvider}</span>}
                {sites.length > 0 && <span className="text-xs text-stone-500 dark:text-stone-400">في: {sites.map(libraryLabel).join('، ')}</span>}
              </div>

              {results.length === 0 ? (
                <EmptyState
                  title="لا توجد نتائج"
                  hint="جرّب كلمات أعم، أو بدّل المكتبة، أو ابحث في الويب كله."
                  action={sites.length > 0 ? { label: 'البحث في الويب كله', onClick: () => update({ sites: undefined }) } : undefined}
                />
              ) : (
                <>
                  {results.map((r) => <WebResultCard key={r.id} result={r} />)}
                  {search.isFetchNextPageError && <p role="alert" className="text-xs text-red-700 dark:text-red-400 text-center">تعذر تحميل المزيد من النتائج.</p>}
                  {search.hasNextPage && (
                    <button onClick={() => void search.fetchNextPage()} disabled={search.isFetchingNextPage} className="btn-ghost self-center !px-6 !py-2.5">
                      {search.isFetchingNextPage && <Loader2 className="w-4 h-4 motion-safe:animate-spin" />}
                      عرض المزيد
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
