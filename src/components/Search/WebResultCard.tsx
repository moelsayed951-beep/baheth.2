import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { AskAiButton } from '@/components/AI/AskAiButton';
import type { WebResult } from '@/types/web';
import { libraryLabel } from '@/utils/libraries';

export const WebResultCard: React.FC<{ result: WebResult }> = ({ result }) => {
  const label = libraryLabel(result.displayLink);
  return (
    <article className="card p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950 text-academic-green dark:text-emerald-300 font-bold flex items-center gap-1 max-w-full">
          <Globe className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        <span dir="ltr" className="text-stone-500 dark:text-stone-400 font-mono text-[11px] truncate">{result.displayLink}</span>
      </div>

      <h2 className="text-base sm:text-lg font-bold font-tajawal text-stone-900 dark:text-stone-100 leading-snug hover:text-academic-green dark:hover:text-academic-gold">
        <a href={result.url} target="_blank" rel="noreferrer noopener" dir="auto">{result.title}</a>
      </h2>

      {result.snippet ? (
        <p dir="auto" className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{result.snippet}</p>
      ) : (
        <p className="text-xs text-stone-400 dark:text-stone-500">لا يتوفر مقتطف من المصدر.</p>
      )}

      <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-2 text-xs">
        <a href={result.url} target="_blank" rel="noreferrer noopener" className="btn-ghost">
          <ExternalLink className="w-3 h-3" />
          <span>فتح الصفحة</span>
        </a>
        <AskAiButton title={result.title} text={result.snippet} url={result.url} />
      </div>
    </article>
  );
};
