import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, Copy, FileDown, FileText, Printer, Trash2, Upload } from 'lucide-react';
import { GoogleSignInButton } from '@/components/Auth/GoogleSignInButton';
import { useAuth } from '@/hooks/useAuth';
import { useLibrary, type LibraryItem } from '@/hooks/useLibrary';
import { importDois, parseDois } from '@/services/doiImport';
import { CITATION_STYLES, formatCitation, sortForBibliography, toBibtex, toRis, type CitationStyle } from '@/utils/citations';
import { buildBibliographyDoc, NOTE_WARNING } from '@/utils/bibliography';
import { downloadText, exportDocx, exportName, printPdf, type ExportDoc } from '@/utils/exporters';
import { normalizeText } from '@/utils/text';

const STYLE_KEY = 'baheth-citation-style';

function loadStyle(): CitationStyle {
  try { const v = localStorage.getItem(STYLE_KEY); if (v === 'apa' || v === 'chicago' || v === 'mla') return v; } catch { /* غير متاح */ }
  return 'apa';
}

const Row: React.FC<{ item: LibraryItem; style: CitationStyle; checked: boolean; onCheck: (v: boolean) => void; onRemove: () => void; onNote: (n: string) => void }> = ({ item, style, checked, onCheck, onRemove, onNote }) => {
  const { paper } = item;
  const c = useMemo(() => formatCitation(paper, style), [paper, style]);
  const [note, setNote] = useState(item.note);
  const [copied, setCopied] = useState(false);
  useEffect(() => setNote(item.note), [item.note]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(c.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt('انسخ التوثيق:', c.text); }
  };

  return (
    <li className="card p-4 flex gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} aria-label={`تحديد: ${paper.title}`} className="mt-1.5 w-4 h-4 accent-academic-green shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <a href={paper.sourceUrl} target="_blank" rel="noreferrer" className="font-bold font-tajawal text-stone-900 dark:text-stone-100 hover:text-academic-green dark:hover:text-academic-gold leading-snug">{paper.title}</a>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          {[paper.authors.slice(0, 3).map((a) => a.name).join('، '), paper.year || '', paper.venue ?? paper.institution].filter(Boolean).join(' · ')}
        </p>
        <p dir={c.rtl ? 'rtl' : 'ltr'} className="text-sm leading-7 text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-900 rounded-lg p-2.5">
          {c.segs.map((s, i) => (s.i ? <i key={i}>{s.t}</i> : <React.Fragment key={i}>{s.t}</React.Fragment>))}
        </p>
        {c.warnings.length > 0 && <p className="text-[11px] text-amber-700 dark:text-amber-400">⚠ ينقص التوثيق: {c.warnings.join('، ')}</p>}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (note !== item.note) onNote(note); }}
          maxLength={2000}
          rows={2}
          placeholder="ملاحظاتك على هذا المرجع (تُحفظ عند الخروج من الخانة)"
          aria-label="ملاحظات"
          className="field text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copy()} className="btn-ghost"><Copy className="w-3 h-3" />{copied ? 'تم النسخ ✓' : 'نسخ التوثيق'}</button>
          <button type="button" onClick={onRemove} className="btn-ghost text-red-700 dark:text-red-400"><Trash2 className="w-3 h-3" />حذف</button>
        </div>
      </div>
    </li>
  );
};

export const LibraryPage: React.FC = () => {
  const lib = useLibrary();
  const { enabled, user, ready } = useAuth();
  const [style, setStyle] = useState<CitationStyle>(loadStyle);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeNotes, setIncludeNotes] = useState(false);
  const [doiText, setDoiText] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const changeStyle = (s: CitationStyle) => { setStyle(s); try { localStorage.setItem(STYLE_KEY, s); } catch { /* غير متاح */ } };

  const filtered = useMemo(() => {
    const n = normalizeText(q);
    if (!n) return lib.items;
    return lib.items.filter((i) => normalizeText(`${i.paper.title} ${i.paper.authors.map((a) => a.name).join(' ')} ${i.paper.venue ?? ''} ${i.note}`).includes(n));
  }, [lib.items, q]);

  const targets = useMemo(() => (selected.size ? filtered.filter((i) => selected.has(i.paper.id)) : filtered), [filtered, selected]);
  const targetPapers = targets.map((i) => i.paper);
  const allChecked = filtered.length > 0 && filtered.every((i) => selected.has(i.paper.id));
  const warnCount = useMemo(() => targetPapers.filter((p) => formatCitation(p, style).warnings.length > 0).length, [targetPapers, style]);

  const doc = (): ExportDoc => buildBibliographyDoc(targetPapers, style, includeNotes ? new Map(targets.map((i) => [i.paper.id, i.note])) : undefined);

  const run = async (label: string, fn: () => void | Promise<void>) => {
    setBusy(label); setMsg('');
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : 'تعذر إكمال العملية'); } finally { setBusy(''); }
  };

  const doImport = () => run('import', async () => {
    const dois = parseDois(doiText);
    if (!dois.length) { setMsg('لم أجد أي DOI صالح في النص. الصق DOI مثل 10.1000/xyz123 أو رابط doi.org.'); return; }
    const { papers, failed } = await importDois(dois);
    let skipped = 0;
    papers.forEach((p) => { if (!lib.add(p)) skipped++; });
    setDoiText('');
    setMsg(`أُضيف ${papers.length - skipped} مرجعاً.${failed.length ? ` تعذر جلب ${failed.length}: ${failed.slice(0, 3).join('، ')}${failed.length > 3 ? '…' : ''}` : ''}${skipped ? ` لم يُضف ${skipped} لامتلاء المكتبة.` : ''}`);
  });

  const upload = () => run('upload', async () => { const n = await lib.uploadLocalToCloud(); setMsg(`رُفع ${n} مرجعاً من هذا الجهاز إلى حسابك.`); });

  const copyAll = () => run('copy', async () => {
    const text = sortForBibliography(targetPapers).map((p) => formatCitation(p, style).text).join('\n\n');
    await navigator.clipboard.writeText(text);
    setMsg(`نُسخ ${targetPapers.length} توثيقاً.`);
  });

  const disabled = targetPapers.length === 0 || Boolean(busy);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold font-tajawal text-stone-900 dark:text-stone-100 flex items-center gap-2"><BookMarked className="w-6 h-6 text-academic-gold" />مكتبتي</h1>
        <p className="text-sm leading-7 text-stone-600 dark:text-stone-300">
          احفظ الأبحاث والرسائل، دوّن ملاحظاتك، ثم ولّد قائمة المراجع بـ APA أو Chicago أو MLA وصدّرها إلى Word أو PDF أو BibTeX/RIS (لـ Zotero وEndNote).
        </p>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          {lib.mode === 'cloud' ? `محفوظة في حسابك (${user?.email}) — حتى ${lib.capacity} مرجع.` : `محفوظة في هذا المتصفح فقط (حتى ${lib.capacity} مرجع) وقد تُمسح بمسح بيانات المتصفح.`}
        </p>
        {enabled && ready && !user && (
          <div className="card p-3 flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-stone-300">
            <span>سجّل الدخول لتحفظ مكتبتك في حسابك وتصل إليها من أي جهاز:</span>
            <GoogleSignInButton />
          </div>
        )}
        {lib.mode === 'cloud' && lib.localCount > 0 && (
          <div className="card p-3 flex flex-wrap items-center gap-3 text-xs">
            <span>على هذا الجهاز {lib.localCount} مرجعاً محفوظاً محلياً.</span>
            <button type="button" onClick={() => void upload()} disabled={Boolean(busy)} className="btn-primary !py-1.5 !px-3 text-xs"><Upload className="w-3.5 h-3.5" />رفعها إلى حسابي</button>
          </div>
        )}
      </header>

      <section className="card p-4 flex flex-col gap-2" aria-label="استيراد مراجع بالـDOI">
        <h2 className="font-bold text-sm text-stone-900 dark:text-stone-100">استخراج بيانات مراجع من DOI</h2>
        <textarea value={doiText} onChange={(e) => setDoiText(e.target.value)} rows={2} dir="ltr" placeholder="الصق DOI أو روابط doi.org (واحداً في كل سطر، حتى 30)" aria-label="DOIs" className="field font-mono text-xs" />
        <button type="button" onClick={() => void doImport()} disabled={!doiText.trim() || Boolean(busy)} className="btn-primary self-start">{busy === 'import' ? 'جاري الجلب من Crossref...' : 'جلب البيانات وإضافتها'}</button>
      </section>

      {lib.items.length > 0 && (
        <section className="card p-4 flex flex-col gap-3" aria-label="أدوات المكتبة">
          <div className="flex flex-wrap gap-3 items-center">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في مكتبتي..." aria-label="بحث في المكتبة" className="field flex-1 min-w-[160px]" />
            <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
              نمط التوثيق:
              <select className="field !w-auto !py-1.5" value={style} onChange={(e) => changeStyle(e.target.value as CitationStyle)}>
                {CITATION_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-stone-300">
            <label className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4 accent-academic-green" checked={allChecked} onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((i) => i.paper.id)) : new Set())} />تحديد الكل</label>
            <span>{selected.size ? `المحدد: ${selected.size}` : `سيُصدَّر الكل (${filtered.length})`}</span>
            <label className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4 accent-academic-green" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />تضمين ملاحظاتي في الملف</label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={disabled} onClick={() => void run('docx', () => exportDocx(doc(), exportName('references', 'docx')))} className="btn-primary !py-2"><FileText className="w-4 h-4" />{busy === 'docx' ? 'جاري الإنشاء...' : 'Word'}</button>
            <button type="button" disabled={disabled} onClick={() => void run('pdf', () => printPdf(doc()))} className="btn-primary !py-2"><Printer className="w-4 h-4" />PDF</button>
            <button type="button" disabled={disabled} onClick={() => downloadText(toBibtex(sortForBibliography(targetPapers)), exportName('references', 'bib'), 'application/x-bibtex')} className="btn-ghost"><FileDown className="w-3.5 h-3.5" />BibTeX</button>
            <button type="button" disabled={disabled} onClick={() => downloadText(toRis(sortForBibliography(targetPapers)), exportName('references', 'ris'), 'application/x-research-info-systems')} className="btn-ghost"><FileDown className="w-3.5 h-3.5" />RIS</button>
            <button type="button" disabled={disabled} onClick={() => void copyAll()} className="btn-ghost"><Copy className="w-3.5 h-3.5" />نسخ الكل</button>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">زر PDF يفتح نافذة الطباعة: اختر «حفظ بصيغة PDF». {warnCount > 0 && `⚠ ${warnCount} مرجعاً ينقصه بعض الحقول. `}{NOTE_WARNING}</p>
        </section>
      )}

      {msg && <p role="status" className="text-sm text-academic-green dark:text-academic-gold">{msg}</p>}
      {lib.loading && <p className="text-sm text-stone-500">جاري التحميل...</p>}

      {!lib.loading && lib.items.length === 0 && (
        <div className="card p-6 text-center text-sm text-stone-600 dark:text-stone-300">
          مكتبتك فارغة. اضغط «حفظ» على أي نتيجة بحث، أو استورد مراجع من DOI أعلاه. <Link to="/search" className="underline text-academic-green dark:text-academic-gold">ابدأ البحث</Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {filtered.map((item) => (
          <Row
            key={item.paper.id}
            item={item}
            style={style}
            checked={selected.has(item.paper.id)}
            onCheck={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(item.paper.id); else n.delete(item.paper.id); return n; })}
            onRemove={() => { lib.remove(item.paper.id); setSelected((s) => { const n = new Set(s); n.delete(item.paper.id); return n; }); }}
            onNote={(note) => lib.setNote(item.paper.id, note)}
          />
        ))}
      </ul>
    </main>
  );
};
