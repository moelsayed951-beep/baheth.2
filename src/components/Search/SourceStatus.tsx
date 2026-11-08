import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import type { SourceReport } from '@/types';

// يعرض حالة المصادر بهدوء: الناجح بشارات خضراء، والفشل الحقيقي بشارات حمراء صغيرة،
// أما ما «يحتاج إعداداً» (مفتاح، تسجيل دخول، تسجيل IP، ازدحام مؤقت) فيُطوى في قسم رمادي هادئ مع طريقة الإصلاح.
const HINT_ICON: Record<string, string> = { needs_key: '🔑', needs_login: '🔐', needs_ip: '🌐', quota: '⏳', no_translation: '🔤', network: '📡', other: 'ℹ️' };

export const SourceStatus: React.FC<{ reports: SourceReport[] }> = ({ reports }) => {
  const ok = reports.filter((r) => r.status === 'ok');
  const failed = reports.filter((r) => r.status === 'error');
  const unavailable = reports.filter((r) => r.status === 'skipped');

  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-wrap gap-2 text-[11px]">
        {ok.map((r) => (
          <li key={r.id} title={r.message} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            <span>{r.label} ({r.count}){r.message ? ` — ${r.message}` : ''}</span>
          </li>
        ))}
        {failed.map((r) => (
          <li key={r.id} title={r.message} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-3 h-3" />
            <span>{r.label} — {r.message && r.message.length < 90 ? r.message : 'تعذر الاتصال مؤقتاً'}</span>
          </li>
        ))}
      </ul>

      {unavailable.length > 0 && (
        <details className="text-[11px] text-stone-600 dark:text-stone-400">
          <summary className="cursor-pointer select-none inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700">
            <MinusCircle className="w-3 h-3" />
            {unavailable.length} {unavailable.length === 1 ? 'مصدر غير متاح' : 'مصادر غير متاحة'} حالياً — التفاصيل
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1 pr-3">
            {unavailable.map((r) => (
              <li key={r.id} className="leading-6">
                <span aria-hidden="true">{HINT_ICON[r.issue?.kind ?? 'other']} </span>
                <strong className="text-stone-800 dark:text-stone-200">{r.label}:</strong> {r.message}
                {r.issue?.action && (
                  <> {' '}<Link to={r.issue.action.to} className="underline font-bold text-academic-green dark:text-academic-gold">{r.issue.action.label}</Link></>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

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
