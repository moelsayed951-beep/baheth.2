import React from 'react';
import { SearchX } from 'lucide-react';

interface Props {
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void };
}

// حالة "لا توجد نتائج"
export const EmptyState: React.FC<Props> = ({ title, hint, action }) => (
  <div className="card py-14 px-6 flex flex-col items-center text-center gap-3">
    <div className="w-14 h-14 rounded-2xl bg-academic-green/10 text-academic-green dark:text-academic-gold flex items-center justify-center">
      <SearchX className="w-7 h-7" />
    </div>
    <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">{title}</h3>
    <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md leading-relaxed">{hint}</p>
    {action && (
      <button onClick={action.onClick} className="btn-primary mt-2">
        {action.label}
      </button>
    )}
  </div>
);
