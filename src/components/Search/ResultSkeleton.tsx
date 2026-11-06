import React from 'react';

// هيكل تحميل (Skeleton) يحاكي شكل بطاقة النتيجة
export const ResultSkeleton: React.FC = () => (
  <div className="card p-5 flex flex-col gap-3 animate-pulse" aria-hidden="true">
    <div className="flex gap-2">
      <div className="h-6 w-36 rounded bg-stone-200 dark:bg-stone-800" />
      <div className="h-6 w-12 rounded bg-stone-200 dark:bg-stone-800" />
    </div>
    <div className="h-5 w-4/5 rounded bg-stone-200 dark:bg-stone-800" />
    <div className="h-3 w-1/3 rounded bg-stone-200 dark:bg-stone-800" />
    <div className="space-y-2">
      <div className="h-3 w-full rounded bg-stone-200 dark:bg-stone-800" />
      <div className="h-3 w-11/12 rounded bg-stone-200 dark:bg-stone-800" />
      <div className="h-3 w-2/3 rounded bg-stone-200 dark:bg-stone-800" />
    </div>
  </div>
);
