import React, { useState } from 'react';
import { Download, ExternalLink, GraduationCap, Quote } from 'lucide-react';
import { AskAiButton } from '@/components/AI/AskAiButton';
import { LibraryButton } from './LibraryButton';
import { EGYPTIAN_UNIVERSITIES } from '@/data/universities';
import type { Paper } from '@/types';
import { buildDeepLinks } from '@/utils/deepLinks';

const TYPE_LABEL: Record<Paper['publicationType'], string> = {
  thesis_master: 'رسالة ماجستير',
  thesis_phd: 'رسالة دكتوراه',
  thesis_other: 'رسالة جامعية',
  journal_article: 'بحث / مقال محكَّم',
  book: 'كتاب / مؤلَّف'
};

export const ResultCard: React.FC<{ paper: Paper }> = ({ paper }) => {
  const [expanded, setExpanded] = useState(false);
  const deepLinks = buildDeepLinks(paper.title, paper.domain);
  const uni = EGYPTIAN_UNIVERSITIES.find((u) => u.id === paper.universityId)?.nameAr ?? paper.institution;
  const authors = paper.authors.slice(0, 6).map((a) => a.name);
  const moreAuthors = paper.authors.length - authors.length;

  return (
    <article className="card p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {uni && (
            <span className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950 text-academic-green dark:text-emerald-300 font-bold flex items-center gap-1 max-w-full">
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{uni}</span>
            </span>
          )}
          {paper.year > 0 && (
            <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 font-mono text-stone-600 dark:text-stone-300">{paper.year}</span>
          )}
          <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-academic-gold-dark dark:text-academic-gold font-semibold">
            {TYPE_LABEL[paper.publicationType]}
          </span>
          {paper.isOpenAccess && (
            <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-semibold">وصول مفتوح</span>
          )}
        </div>
        <span className="text-stone-500 dark:text-stone-400 font-mono text-[11px]">
          {paper.provider === 'web-search' && paper.sourceLabel ? `${paper.sourceLabel} · رابط ذكي` : paper.sources.map((s) => s.toUpperCase()).join(' + ')}
        </span>
      </div>

      <h2 className="text-base sm:text-lg font-bold font-tajawal text-stone-900 dark:text-stone-100 leading-snug hover:text-academic-green dark:hover:text-academic-gold">
        <a href={paper.sourceUrl} target="_blank" rel="noreferrer">
          {paper.title}
        </a>
      </h2>

      {authors.length > 0 && (
        <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
          المؤلفون: {authors.join('، ')}
          {moreAuthors > 0 && ` و${moreAuthors} آخرون`}
        </p>
      )}

      {paper.abstract ? (
        <div>
          <p
            dir="auto"
            className={`text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}
          >
            {paper.abstract}
          </p>
          {paper.abstract.length > 220 && (
            <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-academic-green dark:text-academic-gold hover:underline">
              {expanded ? 'عرض أقل' : 'عرض المزيد'}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-stone-400 dark:text-stone-500">الملخص غير متاح من المصدر.</p>
      )}

      <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {paper.pdfUrl && (
            <a href={paper.pdfUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-academic-green text-white flex items-center gap-1 font-bold hover:bg-academic-green-hover">
              <Download className="w-3 h-3" />
              <span>تحميل PDF</span>
            </a>
          )}
          <a href={paper.sourceUrl} target="_blank" rel="noreferrer" className="btn-ghost">
            <ExternalLink className="w-3 h-3" />
            <span>صفحة المصدر</span>
          </a>
          <AskAiButton title={paper.title} text={paper.abstract} url={paper.sourceUrl} />
          <LibraryButton paper={paper} />
          {paper.citationCount > 0 && (
            <span className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
              <Quote className="w-3 h-3" />
              {paper.citationCount} استشهاد
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-academic-green dark:text-academic-gold font-semibold">
          <span className="text-stone-500 dark:text-stone-400 font-normal">النص الكامل:</span>
          {deepLinks.map((l) => (
            <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="hover:underline">{l.label}</a>
          ))}
        </div>
      </div>
    </article>
  );
};
