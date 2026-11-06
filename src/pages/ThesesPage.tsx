import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, GraduationCap, Search } from 'lucide-react';
import { useChecker } from '@/context/CheckerContext';
import { getOfficialCatalogs } from '@/services/sources/eulcThesesChecker';
import type { TypeFilter } from '@/types';
import { cn } from '@/utils/cn';

const KINDS: { id: TypeFilter; label: string }[] = [
  { id: 'thesis', label: 'كل الرسائل' },
  { id: 'master', label: 'ماجستير' },
  { id: 'phd', label: 'دكتوراه' }
];

// بوابة مخصصة للرسائل الجامعية المصرية والعربية: بحث موجّه + فهارس رسمية للتحقق اليدوي
export const ThesesPage: React.FC = () => {
  const nav = useNavigate();
  const { openChecker } = useChecker();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<TypeFilter>('thesis');
  const [egypt, setEgypt] = useState(false);
  const catalogs = getOfficialCatalogs(q || 'تربية');

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    const p = new URLSearchParams({ q: q.trim(), type: kind, domain: 'all' });
    if (egypt) p.set('egypt', '1');
    nav(`/search?${p.toString()}`);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full flex flex-col gap-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-tajawal text-stone-900 dark:text-stone-100 flex items-center gap-2"><GraduationCap className="w-7 h-7 text-academic-gold" />الرسائل الجامعية المصرية والعربية</h1>
        <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-300">
          بحث موجّه للرسائل (ماجستير ودكتوراه) في قواعد OpenAlex وBASE وHAL وZenodo وCORE وOpenAIRE، ومستودعات الجامعات المصرية (edu.eg) والمكتبات العربية عبر بحث الويب.
        </p>
      </header>

      <form onSubmit={go} className="card p-4 flex flex-col gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="موضوع الرسالة أو كلماتها المفتاحية..." aria-label="موضوع الرسالة" className="field" />
        <div className="flex flex-wrap gap-2 items-center">
          {KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => setKind(k.id)} className={cn('chip', kind === k.id && 'chip-active')}>{k.label}</button>
          ))}
          <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300 mr-auto">
            <input type="checkbox" className="w-4 h-4 accent-academic-green" checked={egypt} onChange={(e) => setEgypt(e.target.checked)} />
            الجهات المصرية فقط (بعد التحقق من الجهة)
          </label>
        </div>
        <button type="submit" disabled={!q.trim()} className="btn-primary self-start"><Search className="w-4 h-4" />ابحث في الرسائل</button>
      </form>

      <section className="card p-4 flex flex-col gap-2 text-sm leading-7">
        <h2 className="font-bold text-stone-900 dark:text-stone-100">ما الذي يغطيه البحث هنا وما لا يغطيه؟</h2>
        <ul className="list-disc pr-5 text-stone-600 dark:text-stone-300">
          <li>يعرض ما تتيحه القواعد المفتوحة وما تفهرسه محركات الويب من مستودعات الجامعات.</li>
          <li>كثير من الرسائل المصرية موجود في فهارس مغلقة أو مشروطة بالاشتراك (مثل EULC ودار المنظومة)، فلن يظهر في النتائج؛ استخدم الفهارس الرسمية أدناه للتحقق اليدوي.</li>
          <li>فلتر «الجهات المصرية» يُظهر فقط ما أكد المصدر أن جهته مصرية، ويُخفي ما تعذّر التحقق منه.</li>
        </ul>
        <button type="button" onClick={() => openChecker(q)} className="btn-ghost self-start mt-1">فحص تقارب عنوان رسالتي المقترح (استرشادي)</button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-sm text-stone-900 dark:text-stone-100">فهارس رسمية للتحقق اليدوي</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {catalogs.map((c) => (
            <a key={c.name} href={c.url} target="_blank" rel="noreferrer" className="card p-3 flex flex-col gap-1 hover:border-academic-green dark:hover:border-academic-gold">
              <strong className="flex justify-between gap-2 text-stone-900 dark:text-stone-100"><span>{c.name}</span><ExternalLink className="w-3.5 h-3.5 shrink-0 text-stone-400" /></strong>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">{c.desc}</span>
            </a>
          ))}
        </div>
        <p className="text-[11px] text-stone-500 dark:text-stone-400">قد تتغير روابط هذه الفهارس مع الوقت؛ إن تعطل رابط فابحث باسم الجهة مباشرة.</p>
      </section>
    </main>
  );
};
