import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchModeTabs } from '@/components/Search/SearchModeTabs';
import { SearchPage } from '@/pages/SearchPage';
import { WebSearchPage } from '@/pages/WebSearchPage';
import type { SearchMode } from '@/types/web';

// مسار /search: يعرض التبويبات ثم الصفحة المناسبة. صفحة البحث الأكاديمي نفسها لم تتغير.
export const SearchRoute: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const mode: SearchMode = params.get('mode') === 'web' ? 'web' : 'academic';

  const switchTo = (m: SearchMode) => {
    if (m === mode) return;
    const next = new URLSearchParams();
    const q = params.get('q');
    if (q) next.set('q', q); // نحتفظ بكلمات البحث فقط؛ لكل نوع فلاتره الخاصة
    if (m === 'web') next.set('mode', 'web');
    setParams(next); // push وليس replace ليعمل زر الرجوع بين التبويبين
  };

  return (
    <>
      <div className="max-w-6xl mx-auto w-full px-4 pt-5">
        <SearchModeTabs mode={mode} onChange={switchTo} />
      </div>
      {mode === 'web' ? <WebSearchPage /> : <SearchPage />}
    </>
  );
};
