import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, ExternalLink, Loader2, Search, ShieldCheck, X } from 'lucide-react';
import { findSimilarTitles, getOfficialCatalogs, type SimilarTitle } from '@/services/sources/eulcThesesChecker';
import type { AcademicDomain } from '@/types';
import { cn } from '@/utils/cn';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
}

export const ThesesCheckerModal: React.FC<Props> = ({ isOpen, onClose, initialTopic = '' }) => {
  const [topic, setTopic] = useState(initialTopic);
  const [domain, setDomain] = useState<AcademicDomain>('education');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SimilarTitle[]>([]);
  const [performed, setPerformed] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // إغلاق بمفتاح Esc ومنع تمرير الخلفية
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  useEffect(() => { if (isOpen) setTopic(initialTopic); }, [isOpen, initialTopic]);

  if (!isOpen) return null;

  const onCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setPerformed(true);
    setFailed(false);
    try {
      setResults(await findSimilarTitles(topic, domain));
    } catch {
      setResults([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const catalogs = topic.trim() ? getOfficialCatalogs(topic) : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checker-title"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-5 sm:p-8 flex flex-col gap-5 my-6">
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 dark:border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-academic-green/10 text-academic-green dark:text-academic-gold flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 id="checker-title" className="text-lg font-bold text-stone-900 dark:text-stone-100">فاحص تقارب العناوين (استرشادي)</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">يقارن ألفاظ عنوانك بعناوين منشورة في قواعد مفتوحة</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div role="note" className="p-3.5 rounded-2xl text-[12px] leading-6 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
          <strong>نطاق الفحص وحدوده:</strong>
          <ul className="list-disc pr-5 mt-1">
            <li>يقارن <strong>ألفاظ العنوان فقط</strong>، ولا يقرأ محتوى الرسالة أو منهجها.</li>
            <li>يبحث في <strong>قواعد مفتوحة</strong>؛ لا يشمل أغلب مستودعات الجامعات المصرية غير المفتوحة ولا قواعد الاشتراكات، فلا يمثل فحصاً شاملاً لرسائل الجامعات المصرية.</li>
            <li><strong>ليس كاشفاً للسرقة العلمية</strong> ولا إفادة رسمية بعدم التكرار. المرجع النهائي هو الجامعة/القسم والفهارس الرسمية أدناه.</li>
          </ul>
        </div>

        <form onSubmit={onCheck} className="flex flex-col gap-3">
          <div className="flex gap-2">
            {([['education', 'تربية'], ['sharia', 'علوم شرعية']] as const).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setDomain(val)} className={cn('chip', domain === val && 'chip-active')}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={inputRef}
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="اكتب عنوان رسالتك المقترح..."
              className="field flex-1"
            />
            <button type="submit" disabled={loading || !topic.trim()} className="btn-primary">
              <Search className="w-4 h-4" />
              <span>فحص التقارب</span>
            </button>
          </div>
        </form>

        {loading && (
          <div className="py-10 text-center flex flex-col items-center gap-3 text-stone-500 dark:text-stone-400 text-xs" role="status">
            <Loader2 className="w-7 h-7 animate-spin text-academic-green dark:text-academic-gold" />
            <span>جاري البحث في المصادر المفتوحة...</span>
          </div>
        )}

        {performed && !loading && (
          <div className="flex flex-col gap-5 max-h-[55vh] overflow-y-auto">
            {failed ? (
              <div className="p-4 rounded-2xl flex items-center gap-3 text-sm bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-900">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>تعذر الاتصال بالمصادر الآن. جرّب لاحقاً أو استخدم الروابط الرسمية أدناه.</span>
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="p-4 rounded-2xl flex items-center gap-3 text-sm bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>وُجدت {results.length} عناوين متقاربة الألفاظ مع عنوانك (لا يعني ذلك تكراراً فعلياً). افتح كلاً منها وقارن المتغيرات والمنهج والعينة.</span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {results.map(({ paper, similarity }) => (
                    <li key={paper.id} className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between gap-2 text-stone-500 dark:text-stone-400">
                        <span>{paper.year > 0 ? paper.year : 'سنة غير معروفة'} • {paper.source.toUpperCase()}</span>
                        <strong className="text-academic-green dark:text-academic-gold" title="نسبة تشاركهما في كلمات العنوان فقط">تقارب ألفاظ {similarity}%</strong>
                      </div>
                      <a href={paper.sourceUrl} target="_blank" rel="noreferrer" className="font-bold text-sm text-stone-900 dark:text-stone-100 hover:underline">
                        {paper.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="p-4 rounded-2xl flex items-center gap-3 text-sm bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>لم نجد عناوين متقاربة في القواعد المفتوحة التي بحثنا فيها. هذا لا يعني أن الموضوع غير مسجل أو غير مكرر؛ تحقق من الفهارس الرسمية أدناه.</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                <BookOpen className="w-4 h-4 text-academic-gold-dark dark:text-academic-gold" />
                الفهارس الرسمية للتحقق اليدوي:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {catalogs.map((c) => (
                  <a key={c.name} href={c.url} target="_blank" rel="noreferrer" className="p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-academic-green dark:hover:border-academic-gold bg-stone-50 dark:bg-stone-800 flex flex-col gap-1">
                    <strong className="flex justify-between gap-2 text-stone-900 dark:text-stone-100">
                      <span>{c.name}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                    </strong>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">{c.desc}</span>
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                تنبيه: النتائج استرشادية من مصادر مفتوحة، ولا تُعد إفادة رسمية بعدم التكرار. المرجع النهائي هو الجامعة/القسم المختص.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
