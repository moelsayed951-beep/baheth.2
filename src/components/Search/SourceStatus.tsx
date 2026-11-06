import React from 'react';
import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import type { SourceReport } from '@/types';

// يعرض حالة كل مصدر: نجح / فشل / تخطى
export const SourceStatus: React.FC<{ reports: SourceReport[] }> = ({ reports }) => (
  <ul className="flex flex-wrap gap-2 text-[11px]">
    {reports.map((r) => (
      <li
        key={r.id}
        title={r.message}
        className={
          r.status === 'ok'
            ? 'flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
            : r.status === 'error'
              ? 'flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300'
              : 'flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
        }
      >
        {r.status === 'ok' && <CheckCircle2 className="w-3 h-3" />}
        {r.status === 'error' && <AlertTriangle className="w-3 h-3" />}
        {r.status === 'skipped' && <MinusCircle className="w-3 h-3" />}
        <span>
          {r.label}
          {r.status === 'ok' && ` (${r.count})`}
          {r.status === 'ok' && r.message && ` — ${r.message}`}
          {r.status === 'error' && ` — ${r.message && r.message.length < 90 ? r.message : 'تعذر الاتصال'}`}
          {r.status === 'skipped' && ` — لم يُستخدم${r.message ? `: ${r.message}` : ''}`}
        </span>
      </li>
    ))}
  </ul>
);

// شارات المصادر التي يجري البحث فيها (أثناء التحميل: "جاري البحث في ...")
export const SourceBadges: React.FC<{ badges: { id: string; label: string; kind: 'api' | 'web-search' }[]; searching?: boolean }> = ({ badges, searching }) => (
  <div className="flex flex-col gap-1.5" aria-label="مصادر البحث">
    <p className="text-[11px] text-stone-500 dark:text-stone-400" role="status">
      {searching ? `جاري البحث في ${badges.map((b) => b.label).join('، ')}...` : `يشمل البحث ${badges.length} مجموعة مصادر:`}
    </p>
    <ul className="flex flex-wrap gap-1.5 text-[11px]">
      {badges.map((b) => (
        <li
          key={b.id}
          className={
            (b.kind === 'api'
              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950 text-academic-gold-dark dark:text-academic-gold') +
            ' px-2 py-1 rounded-lg ' + (searching ? 'animate-pulse' : '')
          }
          title={b.kind === 'api' ? 'واجهة API مباشرة' : 'بحث ويب داخل موقع المكتبة (رابط ذكي)'}
        >
          {b.label}
        </li>
      ))}
    </ul>
  </div>
);
