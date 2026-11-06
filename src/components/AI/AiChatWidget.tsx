import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eraser, FileText, Loader2, Send, Sparkles, X } from 'lucide-react';
import { AI_LABELS, askMany } from '@/services/aiService';
import { useBackendStatus } from '@/hooks/useBackendStatus';
import type { ChatRequest } from '@/context/AiChatContext';
import type { AiAnswer, AiDoc, AiProviderId, ChatTurn } from '@/types/web';
import { cn } from '@/utils/cn';
import { SimpleMarkdown } from './SimpleMarkdown';

type Item =
  | { id: number; role: 'user'; content: string }
  | { id: number; role: 'assistant'; answers: AiAnswer[] };

type Pref = AiProviderId | 'all';
const PREF_KEY = 'baheth-ai-provider';

function readPref(): Pref {
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === 'all' || v === 'gemini' || v === 'grok' || v === 'openai' || v === 'deepseek') return v;
  } catch {
    /* localStorage قد يكون غير متاح */
  }
  return 'gemini'; // الافتراضي: Gemini
}

// تحويل المحادثة إلى رسائل للخادم: نأخذ أول إجابة ناجحة في وضع المقارنة، وندمج الرسائل المتتالية من نفس الدور
function toTurns(items: Item[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const push = (role: ChatTurn['role'], content: string) => {
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += `\n\n${content}`;
    else turns.push({ role, content });
  };
  for (const it of items) {
    if (it.role === 'user') push('user', it.content);
    else {
      const ok = it.answers.find((a) => a.ok && a.text);
      if (ok?.text) push('assistant', ok.text);
    }
  }
  const recent = turns.slice(-12);
  while (recent.length && recent[0].role === 'assistant') recent.shift();
  return recent;
}

const QUICK_WITH_DOC = ['لخّص المرجع', 'ما أبرز الأفكار فيه؟', 'اقترح كلمات بحث قريبة من موضوعه'];
const QUICK_NO_DOC = ['ساعدني في صياغة سؤال بحثي', 'اقترح كلمات مفتاحية لموضوع بحثي', 'كيف أضيّق نطاق بحثي؟'];

export const AiChatWidget: React.FC<{ request: ChatRequest | null }> = ({ request }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [doc, setDoc] = useState<AiDoc | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [pref, setPref] = useState<Pref>(readPref);

  const { loaded, aiProviders } = useBackendStatus(open);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const lastRequestId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // المزوّد المختار فعلياً (قد لا يكون المفضّل مفعّلاً على الخادم)
  const selected: Pref | undefined = pref === 'all' ? (aiProviders.length > 1 ? 'all' : aiProviders[0]) : aiProviders.includes(pref) ? pref : aiProviders[0];
  const targets = useMemo<AiProviderId[]>(() => (selected === 'all' ? aiProviders : selected ? [selected] : []), [selected, aiProviders]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading || targets.length === 0) return;
      const userItem: Item = { id: nextId.current++, role: 'user', content: text };
      const turns = toTurns([...items, userItem]);
      setItems((prev) => [...prev, userItem]);
      setInput('');
      setLoading(true);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      // Promise.allSettled داخل askMany: فشل مزوّد لا يمنع ظهور إجابات الباقين
      const answers = await askMany(targets, turns, doc ?? undefined, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setItems((prev) => [...prev, { id: nextId.current++, role: 'assistant', answers }]);
      setLoading(false);
    },
    [items, loading, targets, doc]
  );

  // طلب فتح قادم من زر «اسأل الذكاء الاصطناعي»
  useEffect(() => {
    if (!request || request.id === lastRequestId.current) return;
    lastRequestId.current = request.id;
    setOpen(true);
    if (request.doc) {
      abortRef.current?.abort();
      setLoading(false);
      setItems([]); // مرجع جديد = محادثة جديدة حتى لا تختلط السياقات
      setDoc(request.doc);
    }
    if (request.prompt) {
      if (request.autoSend) setPending(request.prompt);
      else setInput(request.prompt);
    }
  }, [request]);

  // إرسال النص المعلّق بعد معرفة المزوّدين المفعّلين
  useEffect(() => {
    if (!pending || !loaded) return;
    setPending(null);
    if (targets.length > 0) void send(pending);
  }, [pending, loaded, targets, send]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const clearChat = () => {
    abortRef.current?.abort();
    setItems([]);
    setLoading(false);
    setPending(null);
  };

  const changePref = (v: Pref) => {
    setPref(v);
    try {
      localStorage.setItem(PREF_KEY, v);
    } catch {
      /* تجاهل */
    }
  };

  const notConfigured = loaded && aiProviders.length === 0;
  const quick = doc ? QUICK_WITH_DOC : QUICK_NO_DOC;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="مساعد الباحث بالذكاء الاصطناعي"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          className="card fixed z-50 bottom-20 start-4 end-4 sm:end-auto sm:w-[24rem] h-[min(34rem,calc(100dvh-7rem))] flex flex-col overflow-hidden shadow-xl"
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-stone-200 dark:border-stone-800 bg-academic-green text-white">
            <Sparkles className="w-4 h-4 text-academic-gold shrink-0" />
            <h2 className="font-bold text-sm flex-1 truncate">مساعد الباحث</h2>
            {aiProviders.length > 0 && (
              <select
                aria-label="مزوّد الذكاء الاصطناعي"
                value={selected ?? ''}
                onChange={(e) => changePref(e.target.value as Pref)}
                className="text-xs rounded-md bg-white/15 text-white border border-white/30 px-1.5 py-1 max-w-[9rem]"
              >
                {aiProviders.map((p) => <option key={p} value={p} className="text-stone-900">{AI_LABELS[p]}</option>)}
                {aiProviders.length > 1 && <option value="all" className="text-stone-900">مقارنة بين الكل</option>}
              </select>
            )}
            <button type="button" onClick={clearChat} aria-label="مسح المحادثة" className="p-1.5 rounded-md hover:bg-white/15"><Eraser className="w-4 h-4" /></button>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="p-1.5 rounded-md hover:bg-white/15"><X className="w-4 h-4" /></button>
          </div>

          {doc && (
            <div className="px-3 py-2 border-b border-stone-200 dark:border-stone-800 bg-amber-50 dark:bg-amber-950/40 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 shrink-0 text-academic-gold-dark dark:text-academic-gold" />
                <span className="flex-1 truncate font-semibold text-stone-800 dark:text-stone-100" dir="auto" title={doc.title}>{doc.title}</span>
                <button type="button" onClick={() => setDoc(null)} aria-label="إزالة المرجع من المحادثة" className="p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900"><X className="w-3.5 h-3.5" /></button>
              </div>
              <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-400">
                الإجابة تعتمد على العنوان والمقتطف المتاح فقط، وليس على النص الكامل للمرجع.
              </p>
            </div>
          )}

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-sm" aria-live="polite">
            {notConfigured && (
              <p className="text-xs text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 rounded-xl p-3 leading-relaxed">
                المساعد الذكي يعمل بمفتاحك الخاص حتى تكون تكلفته على حسابك. <Link to="/settings" onClick={() => setOpen(false)} className="underline font-bold text-academic-green dark:text-academic-gold">أضف مفتاحك من صفحة «مفاتيحي»</Link> (يكفي مفتاح Gemini المجاني للبداية).
              </p>
            )}

            {items.length === 0 && !notConfigured && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {doc ? 'اسأل عن هذا المرجع، أو اختر سؤالاً سريعاً:' : 'اسألني عن صياغة سؤال البحث، أو اختيار الكلمات المفتاحية، أو تلخيص ما تجده من نتائج.'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quick.map((q) => (
                    <button key={q} type="button" className="chip" disabled={loading || targets.length === 0} onClick={() => void send(q)}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {items.map((it) =>
              it.role === 'user' ? (
                <div key={it.id} dir="auto" className="self-start max-w-[88%] rounded-2xl bg-academic-green text-white px-3.5 py-2 whitespace-pre-wrap">{it.content}</div>
              ) : (
                <div key={it.id} className="flex flex-col gap-2 w-full">
                  {it.answers.map((a) => (
                    <div
                      key={a.provider}
                      className={cn('rounded-2xl px-3.5 py-2.5', a.ok ? 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100' : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300')}
                    >
                      {it.answers.length > 1 && <p className="text-[11px] font-bold mb-1 text-academic-green dark:text-academic-gold">{AI_LABELS[a.provider]}</p>}
                      {a.ok && a.text ? <SimpleMarkdown text={a.text} /> : <p>{a.error ?? 'تعذر الحصول على إجابة'}</p>}
                    </div>
                  ))}
                </div>
              )
            )}

            {loading && (
              <p className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400" role="status">
                <Loader2 className="w-4 h-4 motion-safe:animate-spin" />
                جاري إعداد الإجابة...
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(input); }}
            className="p-2.5 border-t border-stone-200 dark:border-stone-800 flex flex-col gap-1.5"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={2}
                maxLength={2000}
                aria-label="اكتب سؤالك"
                placeholder={notConfigured ? 'أضف مفتاحك أولاً' : 'اكتب سؤالك...'}
                disabled={notConfigured}
                className="field !py-2 resize-none flex-1"
              />
              <button type="submit" disabled={loading || !input.trim() || targets.length === 0} aria-label="إرسال" className="btn-primary !px-3 !py-3">
                <Send className="w-4 h-4 rtl:-scale-x-100" />
              </button>
            </div>
            <p className="text-[10px] text-stone-400 dark:text-stone-500">إجابات الذكاء الاصطناعي قد تحتوي أخطاء؛ تحقق من المصدر الأصلي قبل الاعتماد عليها.</p>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'إغلاق مساعد الباحث' : 'فتح مساعد الباحث بالذكاء الاصطناعي'}
        className="fixed z-50 bottom-4 start-4 w-14 h-14 rounded-full bg-academic-green text-academic-gold shadow-lg flex items-center justify-center hover:bg-academic-green-hover transition-colors"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>
    </>
  );
};
