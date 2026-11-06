import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { SOURCE_BADGES, aggregateAllSources, deduplicate, filterAndSort, mergeReports } from '@/services/aggregator';
import { ResultCard } from '@/components/Search/ResultCard';
import { ResultSkeleton } from '@/components/Search/ResultSkeleton';
import { EmptyState } from '@/components/Search/EmptyState';
import { SourceBadges, SourceStatus } from '@/components/Search/SourceStatus';
import { FilterPanel, type FilterValues } from '@/components/Search/FilterPanel';
import type { Paper, AcademicDomain, FilterOptions, SortKey, TypeFilter } from '@/types';
import { cn } from '@/utils/cn';

const PAGE_SIZE = 10;
const MAX_PAGES = 40; // أقصى عمق: نحو ألف نتيجة من كل مصدر (حدود واجهات المصادر نفسها)

const toYear = (v: string): number | undefined => {
  const n = Number(v);
  return Number.isInteger(n) && n > 1800 ? n : undefined;
};

// ملاحظات شفافة عن النتائج المخفية بسبب دقة الفلاتر
const FilterNotes: React.FC<{ stats: { hiddenUnknownYear: number; hiddenOffDepartment: number; hiddenUnverifiedEgypt: number } }> = ({ stats }) => {
  const notes = [
    stats.hiddenUnknownYear > 0 && `أُخفيت ${stats.hiddenUnknownYear} نتيجة لأن سنة نشرها غير معروفة (فلتر السنوات مفعّل).`,
    stats.hiddenOffDepartment > 0 && `أُخفيت ${stats.hiddenOffDepartment} نتيجة لا يتضمن عنوانها أو ملخصها مصطلحات القسم المختار.`,
    stats.hiddenUnverifiedEgypt > 0 && `أُخفيت ${stats.hiddenUnverifiedEgypt} نتيجة لتعذّر التحقق من أن جهتها مصرية (تظهر فقط ما أكد المصدر دولته أو جامعته أو نطاقه .eg).`
  ].filter(Boolean) as string[];
  if (!notes.length) return null;
  return <ul className="text-[11px] text-stone-500 dark:text-stone-400 list-disc pr-4">{notes.map((n) => <li key={n}>{n}</li>)}</ul>;
};

export const SearchPage: React.FC = () => {
  const [params, setParams] = useSearchParams();

  // الحالة كلها في الرابط: قابلة للمشاركة وتعمل مع زر الرجوع
  const query = params.get('q')?.trim() ?? '';
  const rawDomain = params.get('domain');
  const domain: AcademicDomain = rawDomain === 'sharia' ? 'sharia' : rawDomain === 'education' ? 'education' : 'all';
  const sort: SortKey = (['relevance', 'year', 'citations'] as const).find((s) => s === params.get('sort')) ?? 'relevance';
  const rawType = params.get('type');
  const values: FilterValues = {
    dept: params.get('dept') ?? '',
    uni: params.get('uni') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    type: (['thesis', 'master', 'phd', 'article', 'book'] as const).find((t) => t === rawType) ?? ('all' as TypeFilter),
    oa: params.get('oa') === '1',
    egypt: params.get('egypt') === '1' // اختياري: حصر النتائج بالجهات المصرية (الافتراضي: كل العالم)
  };

  const [inputVal, setInputVal] = useState(query);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => setInputVal(query), [query]);

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const onFilterChange = (patch: Partial<FilterValues>) => {
    const out: Record<string, string | undefined> = {};
    if ('dept' in patch) out.dept = patch.dept;
    if ('uni' in patch) out.uni = patch.uni;
    if ('from' in patch) out.from = patch.from;
    if ('to' in patch) out.to = patch.to;
    if ('type' in patch) out.type = patch.type === 'all' ? undefined : patch.type;
    if ('oa' in patch) out.oa = patch.oa ? '1' : undefined;
    if ('egypt' in patch) out.egypt = patch.egypt ? '1' : undefined;
    update(out);
  };

  const filters: FilterOptions = {
    query,
    domain,
    universities: values.uni ? [values.uni] : [],
    departments: values.dept ? [values.dept] : [],
    yearStart: toYear(values.from),
    yearEnd: toYear(values.to),
    isOpenAccessOnly: values.oa,
    typeFilter: values.type,
    egyptOnly: values.egypt
  };

  // تحميل متدرّج لا ينتهي عملياً: كل صفحة تجلب الدفعة التالية من كل المصدر، والنتائج تتراكم وتُدمج دون تكرار
  const q = useInfiniteQuery({
    queryKey: ['search', query, domain, values.dept, values.from, values.to, values.type, values.oa, values.egypt],
    queryFn: ({ signal, pageParam }) => aggregateAllSources({ ...filters, page: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.papers.length === 0 || all.length >= MAX_PAGES ? undefined : all.length),
    enabled: query.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 0,
    placeholderData: keepPreviousData
  });
  const { isLoading, isFetching, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = q;

  const data = useMemo(
    () => (q.data ? { papers: deduplicate(q.data.pages.flatMap((p) => p.papers)), reports: mergeReports(q.data.pages), englishQuery: q.data.pages[0]?.englishQuery } : undefined),
    [q.data]
  );

  // الجامعة والترتيب يُطبَّقان محلياً؛ باقي الفلاتر تُعيد الجلب
  const filtered = useMemo(
    () => (data ? filterAndSort(data.papers, { ...filters, englishQuery: data.englishQuery }, sort) : { papers: [] as Paper[], stats: { hiddenUnknownYear: 0, hiddenOffDepartment: 0, hiddenUnverifiedEgypt: 0 } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, values.dept, values.uni, values.from, values.to, values.type, values.oa, values.egypt, sort]
  );
  const shown = filtered.papers;

  // إعادة العدّ عند تغيّر البحث أو الفلاتر
  useEffect(() => setVisible(PAGE_SIZE), [query, domain, values.dept, values.uni, values.from, values.to, values.type, values.oa, values.egypt, sort]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) update({ q: inputVal.trim() });
  };

  const resetFilters = () => update({ dept: undefined, uni: undefined, from: undefined, to: undefined, type: undefined, oa: undefined, egypt: undefined });
  const activeCount = [values.dept, values.uni, values.from, values.to, values.type !== 'all', values.oa, values.egypt].filter(Boolean).length;
  const allFailed = data ? data.reports.every((r) => r.status !== 'ok') : false;
  const loading = isLoading || (isFetching && !data);

  // عرض المزيد: أولاً من المحمَّل محلياً، وإن انتهى نجلب الدفعة التالية من المصادر
  const loadMore = useCallback(() => {
    if (visible < shown.length) setVisible((v) => v + PAGE_SIZE);
    else if (hasNextPage && !isFetchingNextPage) { setVisible((v) => v + PAGE_SIZE); void fetchNextPage(); }
  }, [visible, shown.length, hasNextPage, isFetchingNextPage, fetchNextPage]);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) loadMore(); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, shown.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex-1 w-full">
      <form onSubmit={onSearch} className="mb-5 flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5" role="group" aria-label="المجال">
          {([['all', 'كل المجالات'], ['education', 'تربية'], ['sharia', 'شريعة وأزهر']] as const).map(([val, label]) => (
            <button key={val} type="button" aria-pressed={domain === val} onClick={() => update({ domain: val, dept: undefined })} className={cn('chip', domain === val && 'chip-active')}>
              {label}
            </button>
          ))}
        </div>
        <input type="text" value={inputVal} onChange={(e) => setInputVal(e.target.value)} aria-label="موضوع البحث" placeholder="اكتب موضوع البحث..." className="field flex-1" />
        <button type="submit" className="btn-primary"><Search className="w-4 h-4" />بحث</button>
      </form>

      <div className="mb-5"><SourceBadges badges={SOURCE_BADGES} searching={Boolean(query) && loading} /></div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 shrink-0">
          <button onClick={() => setShowFilters((v) => !v)} className="lg:hidden btn-ghost w-full !py-2.5 mb-3" aria-expanded={showFilters}>
            <SlidersHorizontal className="w-4 h-4" />
            الفلاتر{activeCount > 0 && ` (${activeCount})`}
          </button>
          <div className={cn('card p-4', showFilters ? 'block' : 'hidden lg:block')}>
            <FilterPanel domain={domain} values={values} onChange={onFilterChange} onReset={resetFilters} />
          </div>
        </aside>

        <section className="flex-1 min-w-0 flex flex-col gap-4" aria-live="polite">
          {!query && (
            <EmptyState title="ابدأ بحثك" hint="اكتب موضوع بحثك بالعربية أو الإنجليزية، مثل: التربية الخاصة أو مقاصد الشريعة." />
          )}

          {query && loading && (
            <>
              <p className="text-xs text-stone-500 dark:text-stone-400">جاري جلب النتائج من المصادر العالمية والمكتبات العربية...</p>
              {Array.from({ length: 4 }).map((_, i) => <ResultSkeleton key={i} />)}
            </>
          )}

          {query && !loading && (isError || (data && allFailed)) && (
            <div className="card p-6 flex flex-col items-center text-center gap-3 border-red-200 dark:border-red-900">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              <h3 className="font-bold text-stone-900 dark:text-stone-100">تعذر جلب النتائج</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">تحقق من اتصالك بالإنترنت ثم أعد المحاولة.</p>
              {data && <SourceStatus reports={data.reports} />}
              <button onClick={() => void refetch()} className="btn-primary"><RefreshCw className="w-4 h-4" />إعادة المحاولة</button>
            </div>
          )}

          {query && data && !allFailed && !loading && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-stone-600 dark:text-stone-300">
                    <strong>{shown.length}</strong> نتيجة
                    {shown.length !== data.papers.length && <span className="text-stone-500 dark:text-stone-400"> (من أصل {data.papers.length} بعد التصفية)</span>}
                    {isFetching && <span className="text-stone-400"> — جاري التحديث...</span>}
                  </p>
                  <SourceStatus reports={data.reports} />
                  <FilterNotes stats={filtered.stats} />
                </div>
                <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
                  ترتيب:
                  <select className="field !w-auto !py-1.5" value={sort} onChange={(e) => update({ sort: e.target.value === 'relevance' ? undefined : e.target.value })}>
                    <option value="relevance">الأكثر صلة</option>
                    <option value="year">الأحدث</option>
                    <option value="citations">الأكثر استشهاداً</option>
                  </select>
                </label>
              </div>

              {shown.length === 0 ? (
                <EmptyState
                  title="لا توجد نتائج مطابقة"
                  hint="جرّب كلمات أعم، أو أزل بعض الفلاتر، أو ابحث بالإنجليزية لزيادة النتائج."
                  action={activeCount > 0 ? { label: 'إعادة ضبط الفلاتر', onClick: resetFilters } : undefined}
                />
              ) : (
                <>
                  {shown.slice(0, visible).map((p) => <ResultCard key={p.id} paper={p} />)}
                  <div ref={sentinel} aria-hidden="true" className="h-1" />
                  {(visible < shown.length || hasNextPage) ? (
                    <button onClick={loadMore} disabled={isFetchingNextPage} className="btn-ghost self-center !px-6 !py-2.5">
                      {isFetchingNextPage ? 'جاري جلب المزيد من المصادر...' : visible < shown.length ? `عرض المزيد (${shown.length - visible} محمَّلة)` : 'تحميل المزيد من المصادر'}
                    </button>
                  ) : (
                    <p className="text-center text-xs text-stone-500 dark:text-stone-400">وصلت إلى نهاية ما توفره المصادر لهذا البحث. جرّب كلمات أخرى أو ابحث بالإنجليزية.</p>
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
