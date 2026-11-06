import React from 'react';
import { BookMarked, GraduationCap } from 'lucide-react';
import type { SearchMode } from '@/types/web';
import { cn } from '@/utils/cn';

const TABS: { id: SearchMode; label: string; icon: React.ReactNode }[] = [
  { id: 'academic', label: 'البحث الأكاديمي (الرسائل والأبحاث)', icon: <GraduationCap className="w-4 h-4 shrink-0" /> },
  { id: 'web', label: 'بحث الويب (كتب ومواقع)', icon: <BookMarked className="w-4 h-4 shrink-0" /> }
];

// تبويبات نوع البحث: أكاديمي (النظام الحالي) | ويب (المكتبات الإلكترونية)
export const SearchModeTabs: React.FC<{ mode: SearchMode; onChange: (m: SearchMode) => void; className?: string }> = ({ mode, onChange, className }) => (
  <div role="tablist" aria-label="نوع البحث" className={cn('inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-stone-100 dark:bg-stone-800', className)}>
    {TABS.map((t) => (
      <button
        key={t.id}
        type="button"
        role="tab"
        aria-selected={mode === t.id}
        onClick={() => onChange(t.id)}
        className={cn(
          'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors',
          mode === t.id
            ? 'bg-white dark:bg-stone-900 text-academic-green dark:text-academic-gold shadow-sm'
            : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
        )}
      >
        {t.icon}
        <span>{t.label}</span>
      </button>
    ))}
  </div>
);
