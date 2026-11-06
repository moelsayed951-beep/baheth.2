// ============================================================
// تصدير: Word (.docx حقيقي بدعم RTL) / PDF (عبر طباعة المتصفح حفاظاً على تشكيل العربية) / BibTeX / RIS / نص
// ============================================================
import type { Citation } from '@/utils/citations';

export interface ExportSection {
  heading?: string;
  paragraphs?: string[]; // فقرات نصية عادية
  refs?: Citation[]; // قائمة مراجع (بتنسيق معلّق)
}
export interface ExportDoc {
  title: string;
  subtitle?: string;
  rtl: boolean;
  sections: ExportSection[];
  note?: string; // سطر تنبيه في آخر المستند
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const downloadText = (text: string, filename: string, mime = 'text/plain'): void =>
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);

const stamp = (): string => new Date().toISOString().slice(0, 10);
export const exportName = (base: string, ext: string): string => `${base}-${stamp()}.${ext}`;

/* ---------------- Word ---------------- */
export async function buildDocx(doc: ExportDoc): Promise<import('docx').Document> {
  const { Document, Paragraph, TextRun, AlignmentType, HeadingLevel } = await import('docx');
  const FONT = 'Arial';
  const rtlRun = (text: string, extra: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
    new TextRun({ text, font: FONT, rightToLeft: doc.rtl, ...extra });
  const align = AlignmentType.START; // مع bidi تعني اليمين في العربية

  const children: InstanceType<typeof Paragraph>[] = [];
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, bidirectional: doc.rtl, alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [rtlRun(doc.title, { bold: true, size: 36 })] }));
  if (doc.subtitle) children.push(new Paragraph({ bidirectional: doc.rtl, alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [rtlRun(doc.subtitle, { size: 22 })] }));

  for (const s of doc.sections) {
    if (s.heading) children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: doc.rtl, alignment: align, spacing: { before: 280, after: 120 }, children: [rtlRun(s.heading, { bold: true, size: 28 })] }));
    for (const para of s.paragraphs ?? []) {
      for (const line of para.split('\n')) {
        children.push(new Paragraph({ bidirectional: doc.rtl, alignment: align, spacing: { after: 100, line: 340 }, children: [rtlRun(line, { size: 24 })] }));
      }
    }
    for (const c of s.refs ?? []) {
      children.push(new Paragraph({
        bidirectional: c.rtl,
        alignment: align,
        indent: { left: 720, hanging: 720 }, // تنسيق «معلّق» المعتمد في قوائم المراجع
        spacing: { after: 140, line: 320 },
        children: c.segs.map((seg) => new TextRun({ text: seg.t, italics: seg.i, font: FONT, size: 24, rightToLeft: c.rtl }))
      }));
    }
  }
  if (doc.note) children.push(new Paragraph({ bidirectional: doc.rtl, alignment: align, spacing: { before: 400 }, children: [rtlRun(doc.note, { italics: true, size: 20 })] }));

  return new Document({
    creator: 'باحث',
    title: doc.title,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }]
  });
}

export async function exportDocx(doc: ExportDoc, filename: string): Promise<void> {
  const { Packer } = await import('docx');
  downloadBlob(await Packer.toBlob(await buildDocx(doc)), filename);
}

/* ---------------- PDF (طباعة المتصفح) ---------------- */
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildPrintHtml(doc: ExportDoc): string {
  const dir = doc.rtl ? 'rtl' : 'ltr';
  const body = doc.sections.map((s) => [
    s.heading ? `<h2>${esc(s.heading)}</h2>` : '',
    ...(s.paragraphs ?? []).flatMap((p) => p.split('\n').map((l) => `<p>${esc(l)}</p>`)),
    ...(s.refs ?? []).map((c) => `<p class="ref" dir="${c.rtl ? 'rtl' : 'ltr'}">${c.html}</p>`)
  ].join('\n')).join('\n');
  return `<!doctype html><html lang="${doc.rtl ? 'ar' : 'en'}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(doc.title)}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: 'Noto Naskh Arabic','Traditional Arabic',Tahoma,Arial,serif; font-size: 13pt; line-height: 1.9; color: #111; }
  h1 { text-align: center; font-size: 20pt; margin: 0 0 6pt; }
  .sub { text-align: center; color: #444; margin-bottom: 18pt; }
  h2 { font-size: 15pt; margin: 18pt 0 6pt; }
  p { margin: 0 0 6pt; }
  .ref { padding-inline-start: 1.27cm; text-indent: -1.27cm; margin-bottom: 9pt; }
  .note { margin-top: 24pt; font-size: 10.5pt; color: #444; font-style: italic; }
</style></head><body>
<h1>${esc(doc.title)}</h1>${doc.subtitle ? `<div class="sub">${esc(doc.subtitle)}</div>` : ''}
${body}
${doc.note ? `<div class="note">${esc(doc.note)}</div>` : ''}
</body></html>`;
}

// يفتح مربع طباعة المتصفح: اختر «حفظ بصيغة PDF». (تشكيل العربية يتولاه المتصفح فيبقى سليماً.)
export function printPdf(doc: ExportDoc): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const w = frame.contentWindow;
  if (!w) { frame.remove(); return; }
  w.document.open();
  w.document.write(buildPrintHtml(doc));
  w.document.close();
  const go = () => { w.focus(); w.print(); setTimeout(() => frame.remove(), 60_000); };
  if (w.document.readyState === 'complete') setTimeout(go, 250); else frame.onload = () => setTimeout(go, 250);
}
