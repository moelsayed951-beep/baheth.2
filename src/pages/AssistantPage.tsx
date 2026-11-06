import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileText, Printer, Sparkles } from 'lucide-react';
import { useBackendStatus } from '@/hooks/useBackendStatus';
import { useLibrary } from '@/hooks/useLibrary';
import { askResearch, AI_LABELS, type ResearchTask } from '@/services/aiService';
import { CITATION_STYLES, formatCitation, type Citation, type CitationStyle } from '@/utils/citations';
import { auditOutput, plainifyMarkdown } from '@/utils/citationGuard';
import { exportDocx, exportName, printPdf, type ExportDoc } from '@/utils/exporters';
import { ProxyError } from '@/utils/proxy';
import type { AiProviderId } from '@/types/web';

const MAX_REFS = 10;
const TASKS: { id: ResearchTask; label: string; hint: string; needsRefs: boolean }[] = [
  { id: 'plan', label: 'خطة بحث', hint: 'المشكلة والأهداف والأسئلة والمنهج وهيكل الفصول', needsRefs: false },
  { id: 'framework', label: 'إطار نظري', hint: 'المفاهيم والنظريات المرتبطة بموضوعك', needsRefs: false },
  { id: 'previous', label: 'دراسات سابقة', hint: 'تلخيص وتعقيب على المراجع التي تختارها من مكتبتك', needsRefs: true },
  { id: 'questions', label: 'أسئلة وفروض', hint: 'أسئلة البحث والفروض والمتغيرات', needsRefs: false },
  { id: 'gap', label: 'الفجوة البحثية', hint: 'تحليل ما تناولته المراجع وما لم تتناوله', needsRefs: true }
];
const DRAFT_NOTE = 'مسودة مولّدة بالذكاء الاصطناعي بالاعتماد على المراجع التي اختارها الباحث. تحتاج مراجعة علمية كاملة وتحقق من كل إحالة وكل معلومة قبل الاعتماد؛ ولا تغني عن الرجوع إلى المصادر الأصلية.';

export const AssistantPage: React.FC = () => {
  const { aiProviders, loaded } = useBackendStatus();
  const lib = useLibrary();
  const [provider, setProvider] = useState<AiProviderId | ''>('');
  const [task, setTask] = useState<ResearchTask>('plan');
  const [topic, setTopic] = useState('');
  const [extra, setExtra] = useState('');
  const [style, setStyle] = useState<CitationStyle>('apa');
  const [picked, setPicked] = useState<string[]>([]); // ترتيب الاختيار = ترقيم [n]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ text: string; refs: typeof lib.items; task: ResearchTask; topic: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const active: AiProviderId | '' = provider && aiProviders.includes(provider) ? provider : aiProviders[0] ?? '';
  const taskInfo = TASKS.find((t) => t.id === task) as (typeof TASKS)[number];
  const pickedItems = useMemo(() => picked.map((id) => lib.items.find((i) => i.paper.id === id)).filter((i): i is (typeof lib.items)[number] => Boolean(i)), [picked, lib.items]);
  const canRun = Boolean(active) && topic.trim().length >= 5 && !loading && (!taskInfo.needsRefs || pickedItems.length > 0);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_REFS ? p : [...p, id]));

  const run = async () => {
    if (!active) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setLoading(true); setError(''); setResult(null);
    const prompt = [`موضوع البحث: ${topic.trim()}`, extra.trim() && `تعليمات إضافية من الباحث: ${extra.trim()}`].filter(Boolean).join('\n');
    try {
      const text = await askResearch(active, task, prompt, pickedItems.map(({ paper: p }) => ({
        title: p.title, authors: p.authors.slice(0, 6).map((a) => a.name).join('، '), year: p.year ? String(p.year) : '', abstract: p.abstract
      })), ctl.signal);
      setResult({ text: plainifyMarkdown(text), refs: pickedItems, task, topic: topic.trim() });
    } catch (e) {
      if (ctl.signal.aborted) return;
      setError(e instanceof ProxyError ? e.message : 'تعذر الحصول على الرد. حاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  const report = useMemo(() => (result ? auditOutput(result.text, result.refs.map((r) => r.paper)) : null), [result]);

  // قائمة المراجع مولَّدة من بياناتنا نحن (لا من النموذج) ومرتبة برقم الإحالة
  const numbered: Citation[] = useMemo(() => (result ? result.refs.map((r, i) => {
    const c = formatCitation(r.paper, style);
    return { ...c, segs: [{ t: `[${i + 1}] ` }, ...c.segs], text: `[${i + 1}] ${c.text}`, html: `[${i + 1}] ${c.html}` };
  }) : []), [result, style]);

  const buildDoc = (): ExportDoc => ({
    title: `${TASKS.find((t) => t.id === result?.task)?.label ?? 'مسودة'}: ${result?.topic ?? ''}`,
    subtitle: 'مسودة بمساعدة الذكاء الاصطناعي — تحتاج مراجعة الباحث',
    rtl: true,
    sections: [
      { paragraphs: (result?.text ?? '').split(/\n{2,}/) },
      ...(numbered.length ? [{ heading: 'قائمة المراجع (مرتبة بحسب أرقام الإحالات)', refs: numbered }] : [])
    ],
    note: DRAFT_NOTE
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold font-tajawal text-stone-900 dark:text-stone-100 flex items-center gap-2"><Sparkles className="w-6 h-6 text-academic-gold" />مساعد البحث العلمي</h1>
        <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-300">
          يساعدك في مسودات الخطة والإطار النظري والدراسات السابقة <strong>بالاعتماد على مراجعك المحفوظة وحدها</strong>. لا يُسمح له بذكر أي مصدر خارج ما تختاره، وتُفحص إحالاته آلياً بعد الكتابة.
        </p>
      </header>

      {loaded && aiProviders.length === 0 && (
        <div className="card p-4 text-sm border-amber-300 dark:border-amber-800">
          يعمل المساعد بمفتاحك الخاص. <Link to="/settings" className="underline font-bold text-academic-green dark:text-academic-gold">أضف مفتاحك من صفحة «مفاتيحي»</Link> (يكفي مفتاح Gemini المجاني للبداية).
        </div>
      )}

      <section className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="المهمة">
          {TASKS.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={task === t.id} onClick={() => setTask(t.id)} className={`px-3 py-2 rounded-xl text-sm border ${task === t.id ? 'bg-academic-green text-white border-academic-green' : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'}`}>{t.label}</button>
          ))}
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400">{taskInfo.hint}{taskInfo.needsRefs && ' — يتطلب اختيار مرجع واحد على الأقل.'}</p>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} maxLength={1500} placeholder="اكتب موضوع بحثك أو عنوانه المبدئي وما تريده بالتحديد" aria-label="موضوع البحث" className="field" />
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} maxLength={800} placeholder="تعليمات إضافية (اختياري): المنهج، المرحلة التعليمية، التخصص..." aria-label="تعليمات إضافية" className="field" />
        <div className="flex flex-wrap gap-3 items-center">
          {aiProviders.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">المزوّد:
              <select className="field !w-auto !py-1.5" value={active} onChange={(e) => setProvider(e.target.value as AiProviderId)}>
                {aiProviders.map((p) => <option key={p} value={p}>{AI_LABELS[p]}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">نمط توثيق المراجع:
            <select className="field !w-auto !py-1.5" value={style} onChange={(e) => setStyle(e.target.value as CitationStyle)}>
              {CITATION_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card p-4 flex flex-col gap-2" aria-label="مراجع من مكتبتي">
        <h2 className="font-bold text-sm text-stone-900 dark:text-stone-100">مراجعك ({picked.length}/{MAX_REFS})</h2>
        {lib.items.length === 0 ? (
          <p className="text-xs text-stone-600 dark:text-stone-300">مكتبتك فارغة. احفظ أبحاثاً من <Link to="/search" className="underline">نتائج البحث</Link> ليستند إليها المساعد. بدون مراجع يكتب هيكلاً عاماً فقط بلا إحالات.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
            {lib.items.map((i) => {
              const n = picked.indexOf(i.paper.id) + 1;
              return (
                <li key={i.paper.id}>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="mt-1 w-4 h-4 accent-academic-green" checked={n > 0} onChange={() => toggle(i.paper.id)} disabled={n === 0 && picked.length >= MAX_REFS} />
                    <span className="text-stone-700 dark:text-stone-300">{n > 0 && <strong className="text-academic-green dark:text-academic-gold">[{n}] </strong>}{i.paper.title} <span className="text-xs text-stone-500">({i.paper.year || 'د.ت'}{i.paper.abstract ? '' : ' · بلا ملخص'})</span></span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" onClick={() => void run()} disabled={!canRun} className="btn-primary self-start mt-1">{loading ? 'جاري الكتابة...' : 'اكتب المسودة'}</button>
      </section>

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {result && report && (
        <section className="flex flex-col gap-3" aria-live="polite">
          <div className={`card p-4 text-sm flex flex-col gap-1.5 ${report.ok ? 'border-emerald-300 dark:border-emerald-800' : 'border-red-300 dark:border-red-800'}`}>
            <p className="font-bold flex items-center gap-2">
              {report.ok ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" />الفحص الآلي: كل الإحالات تطابق مراجعك المختارة</> : <><AlertTriangle className="w-4 h-4 text-red-600" />الفحص الآلي: وُجدت إحالات أو مصادر لا تطابق مراجعك — لا تعتمدها</>}
            </p>
            {report.invalidRefs.length > 0 && <p className="text-red-700 dark:text-red-400">إحالات برقم غير موجود: {report.invalidRefs.map((n) => `[${n}]`).join('، ')}</p>}
            {report.suspiciousCitations.length > 0 && <p className="text-red-700 dark:text-red-400">استشهادات (اسم، سنة) لا تطابق أي مرجع عندك: {report.suspiciousCitations.join('؛ ')}</p>}
            {(report.foreignDois.length > 0 || report.foreignUrls.length > 0) && <p className="text-red-700 dark:text-red-400" dir="ltr">روابط/DOI خارج مراجعك: {[...report.foreignDois, ...report.foreignUrls].join(' ; ')}</p>}
            {report.pageNumbers.length > 0 && <p className="text-amber-700 dark:text-amber-400">ذُكرت أرقام صفحات لا توجد في بيانات مراجعك: {report.pageNumbers.join('، ')}</p>}
            {report.needsSource > 0 && <p className="text-amber-700 dark:text-amber-400">وسم النموذج {report.needsSource} موضعاً بأنه «بحاجة إلى مصدر»: ابحث له عن سند أو احذفه.</p>}
            <p className="text-xs text-stone-500 dark:text-stone-400">الفحص جزئي ولا يضمن صحة المحتوى العلمي؛ راجع كل ادعاء مع المصدر. أُحيل في النص إلى: {report.usedRefs.length ? report.usedRefs.map((n) => `[${n}]`).join(' ') : 'لا شيء'}.</p>
          </div>

          <article className="card p-5 text-sm leading-8 whitespace-pre-wrap text-stone-800 dark:text-stone-200">{result.text}</article>

          {numbered.length > 0 && (
            <div className="card p-4 flex flex-col gap-2">
              <h2 className="font-bold text-sm">قائمة المراجع (مولّدة من بياناتك، مرتبة بأرقام الإحالات)</h2>
              {numbered.map((c, i) => (
                <p key={i} dir={c.rtl ? 'rtl' : 'ltr'} className="text-sm leading-7">{c.segs.map((s, j) => (s.i ? <i key={j}>{s.t}</i> : <React.Fragment key={j}>{s.t}</React.Fragment>))}</p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary !py-2" onClick={() => void exportDocx(buildDoc(), exportName('draft', 'docx'))}><FileText className="w-4 h-4" />تصدير Word</button>
            <button type="button" className="btn-primary !py-2" onClick={() => printPdf(buildDoc())}><Printer className="w-4 h-4" />PDF</button>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">{DRAFT_NOTE}</p>
        </section>
      )}
    </main>
  );
};
