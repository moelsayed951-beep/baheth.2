import React from 'react';
import { BookmarkCheck, BookmarkPlus } from 'lucide-react';
import type { Paper } from '@/types';
import { useLibrary } from '@/hooks/useLibrary';
import { cn } from '@/utils/cn';

// زر «حفظ في مكتبتي»: يعمل بلا حساب (محلياً)، وبالحساب يُحفظ سحابياً.
export const LibraryButton: React.FC<{ paper: Paper }> = ({ paper }) => {
  const lib = useLibrary();
  const saved = lib.has(paper.id);
  return (
    <button
      type="button"
      onClick={() => { if (!lib.toggle(paper)) window.alert('امتلأت مكتبة هذا الجهاز. احذف بعض العناصر أو سجّل الدخول لمكتبة أكبر.'); }}
      aria-pressed={saved}
      title={lib.error || (saved ? 'إزالة من مكتبتي' : 'حفظ في مكتبتي')}
      className={cn('btn-ghost', saved && 'text-academic-green dark:text-academic-gold')}
    >
      {saved ? <BookmarkCheck className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
      <span>{saved ? 'في مكتبتي' : 'حفظ'}</span>
    </button>
  );
};
