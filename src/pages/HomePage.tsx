import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, Sparkles } from 'lucide-react';
import { SearchModeTabs } from '@/components/Search/SearchModeTabs';
import { useChecker } from '@/context/CheckerContext';
import type { AcademicDomain, TypeFilter } from '@/types';
import type { SearchMode } from '@/types/web';
import { cn } from '@/utils/cn';
import { LIBRARY_PRESETS, MAX_SITES } from '@/utils/libraries';

const EXAMPLES: Record<AcademicDomain, string[]> = {
  all: ['التربية الخاصة', 'الذكاء الاصطناعي في التعليم', 'الصحة النفسية', 'artificial intelligence'],
  education: ['التربية الخاصة', 'صعوبات التعلم', 'التعليم الإلكتروني', 'التفكير الناقد'],
  sharia: ['مقاصد الشريعة', 'المصارف الإسلامية', 'القواعد الفقهية', 'علوم القرآن']
};

const WEB_EXAMPLES = ['الأربعون النووية شرح', 'أصول الفقه', 'علوم الحديث', 'طرق التدريس الحديثة'];

export const HomePage: React.FC = () => {
  const [mode, setMode] = useState<SearchMode>('academic');
  const [sites, setSites] = useState<string[]>([]);
  const [azhar, setAzhar] = useState(false);
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState<AcademicDomain>('all');
  const [scope, setScope] = useState<TypeFilter>('all');
  const navigate = useNavigate();
  const { openChecker } = useChecker();

  const toggleSite = (host: string) =>
    setSites((cur) => (cur.includes(host) ? cur.filter((s) => s !== host) : cur.length < MAX_SITES ? [...cur, host] : cur));

  const go = (text: string) => {
    if (!text.trim()) return;
    if (mode === 'web') {
      navigate(`/search?q=${encodeURIComponent(text.trim())}&mode=web${sites.length ? `&sites=${encodeURIComponent(sites.join(','))}` : ''}${azhar ? '&faculty=azhar' : ''}`);
      return;
    }
    navigate(`/search?q=${encodeURIComponent(text.trim())}&domain=${domain}${scope === 'all' ? '' : `&type=${scope}`}`);
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16 text-center max-w-4xl mx-auto w-full">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-academic-green/10 text-academic-green dark:text-academic-gold text-xs font-bold mb-4">
        <Sparkles className="w-3.5 h-3.5" />
        <span>آفاق بحث واسعة للباحث في التربية</span>
      </div>

      <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 dark:text-stone-100 leading-tight">
        أبحاث علمية • رسائل ماجستير • رسائل دكتوراه <br />
        <span className="text-academic-green dark:text-academic-gold">في التربية</span>
      </h1>
      <p className="mt-4 text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-xl leading-relaxed">
        ابحث في الأبحاث العلمية والرسائل الجامعية والكتب والمؤلفات عبر المواقع والصفحات والمجلات المختلفة، في بحث واحد مع إزالة التكرار وفلاتر بالجامعة والسنة ونوع الإنتاج العلمي.
      </p>

      <SearchModeTabs mode={mode} onChange={setMode} className="mt-8" />

      {mode === 'academic' && (
      <>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="المجال">
        {([['all', '🌍 كل المجالات'], ['education', '📚 التربية والمناهج'], ['sharia', '🕌 العلوم الشرعية']] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            aria-pressed={domain === val}
            onClick={() => setDomain(val)}
            className={cn('px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all', domain === val ? 'bg-academic-green text-white shadow' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="نوع الإنتاج العلمي">
        {([['all', 'الكل'], ['article', 'أبحاث علمية'], ['master', 'رسائل ماجستير'], ['phd', 'رسائل دكتوراه'], ['book', 'كتب ومؤلفات']] as const).map(([val, label]) => (
          <button key={val} type="button" aria-pressed={scope === val} onClick={() => setScope(val)} className={cn('chip', scope === val && 'chip-active')}>
            {label}
          </button>
        ))}
      </div>
      </>
      )}

      {mode === 'web' && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="المكتبة">
          {LIBRARY_PRESETS.map((p) => (
            <button key={p.host} type="button" aria-pressed={sites.includes(p.host)} onClick={() => toggleSite(p.host)} className={cn('chip', sites.includes(p.host) && 'chip-active')}>
              {p.label}
            </button>
          ))}
          <button type="button" aria-pressed={azhar} onClick={() => setAzhar((v) => !v)} className={cn('chip', azhar && 'chip-active')}>
            🎓 كلية التربية – جامعة الأزهر
          </button>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 w-full">{sites.length === 0 ? 'بدون اختيار: البحث في الويب كله' : 'البحث مقيَّد بالمكتبات المختارة'}</span>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); go(q); }} className="mt-4 w-full max-w-2xl relative">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="موضوع البحث"
          placeholder={mode === 'web' ? 'ابحث عن كتاب أو موضوع (مثال: شرح الأربعين النووية)...' : domain === 'education' ? 'ابحث بموضوع البحث (مثال: التربية الخاصة، صعوبات التعلم)...' : 'ابحث بموضوع البحث (مثال: مقاصد الشريعة، فقه المعاملات)...'}
          className="field !py-4 !pr-12 !pl-24 !rounded-2xl shadow-lg sm:text-base"
        />
        <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <button type="submit" className="btn-primary absolute left-2 top-1/2 -translate-y-1/2 !px-5">بحث</button>
      </form>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {(mode === 'web' ? WEB_EXAMPLES : EXAMPLES[domain]).map((ex) => (
          <button key={ex} type="button" onClick={() => go(ex)} className="chip">{ex}</button>
        ))}
      </div>

      <button
        onClick={() => openChecker(q)}
        className="mt-8 inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-academic-green dark:text-academic-gold hover:underline"
      >
        <ShieldCheck className="w-4 h-4" />
        <span>هل عنوان رسالتك مكرر؟ افحص تشابهه مع عناوين منشورة</span>
      </button>
    </main>
  );
};
