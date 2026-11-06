// ============================================================
// توثيق المراجع: APA 7 / Chicago 17 (قائمة المراجع) / MLA 9
// يُولَّد من بيانات المصدر فقط، ويُرجع تحذيراً بكل حقل ناقص بدل اختلاق قيمة.
// ============================================================
import type { Paper } from '@/types';
import { hasArabic } from '@/utils/text';

export type CitationStyle = 'apa' | 'chicago' | 'mla';
export const CITATION_STYLES: { id: CitationStyle; label: string }[] = [
  { id: 'apa', label: 'APA (الإصدار 7)' },
  { id: 'chicago', label: 'Chicago (الإصدار 17)' },
  { id: 'mla', label: 'MLA (الإصدار 9)' }
];

export interface Seg { t: string; i?: boolean }
export interface Citation { segs: Seg[]; text: string; html: string; warnings: string[]; rtl: boolean }

/* ---------------- الأسماء ---------------- */
interface Name { full: string; first: string; last: string; arabic: boolean }

function parseName(raw: string): Name {
  const full = raw.replace(/\s+/g, ' ').trim();
  if (hasArabic(full)) return { full, first: full, last: '', arabic: true };
  if (full.includes(',')) {
    const [last, ...rest] = full.split(',');
    return { full, last: last.trim(), first: rest.join(' ').trim(), arabic: false };
  }
  const parts = full.split(' ');
  if (parts.length === 1) return { full, last: full, first: '', arabic: false };
  const last = parts[parts.length - 1];
  return { full, last, first: parts.slice(0, -1).join(' '), arabic: false };
}

const initials = (first: string): string =>
  first.split(/[\s-]+/).filter(Boolean).map((w) => `${w[0].toUpperCase()}.`).join(' ');

// الاسم بصيغة «العائلة، الأول»
const inverted = (n: Name, style: CitationStyle): string => {
  if (n.arabic || !n.first) return n.full;
  return style === 'apa' ? `${n.last}, ${initials(n.first)}` : `${n.last}, ${n.first}`;
};
const natural = (n: Name): string => (n.arabic || !n.first ? n.full : `${n.first} ${n.last}`);

function joinAuthors(list: Name[], style: CitationStyle, ar: boolean): string {
  const and = ar ? 'و' : style === 'apa' ? '&' : 'and';
  const comma = ar ? '، ' : ', ';
  if (!list.length) return '';

  if (style === 'apa') {
    const f = list.map((n) => inverted(n, 'apa'));
    if (f.length === 1) return f[0];
    if (f.length === 2) return `${f[0]}${ar ? ' ' : ', '}${and} ${f[1]}`;
    if (f.length <= 20) return `${f.slice(0, -1).join(comma)}${comma}${and} ${f[f.length - 1]}`;
    return `${f.slice(0, 19).join(comma)}${comma}. . . ${f[f.length - 1]}`;
  }
  if (style === 'mla') {
    if (list.length >= 3) return `${inverted(list[0], 'mla')}${comma}${ar ? 'وآخرون' : 'et al.'}`;
    if (list.length === 2) return `${inverted(list[0], 'mla')}${comma}${and} ${natural(list[1])}`;
    return inverted(list[0], 'mla');
  }
  // chicago
  const names = list.length > 10 ? list.slice(0, 7) : list;
  const parts = names.map((n, i) => (i === 0 ? inverted(n, 'chicago') : natural(n)));
  if (list.length > 10) return `${parts.join(comma)}${comma}${ar ? 'وآخرون' : 'et al.'}`;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}${ar ? ' ' : ', '}${and} ${parts[1]}`;
  return `${parts.slice(0, -1).join(comma)}${comma}${and} ${parts[parts.length - 1]}`;
}

/* ---------------- أدوات ---------------- */
const endDot = (s: string): string => (/[.!?؟]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function link(p: Paper): string {
  if (p.doi) return `https://doi.org/${p.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`;
  return p.sourceUrl ?? '';
}

type Kind = 'article' | 'master' | 'phd' | 'thesis' | 'book';
const kindOf = (p: Paper): Kind =>
  p.publicationType === 'thesis_master' ? 'master' : p.publicationType === 'thesis_phd' ? 'phd' : p.publicationType === 'thesis_other' ? 'thesis' : p.publicationType === 'book' ? 'book' : 'article';

const thesisLabel = (k: Kind, ar: boolean): string =>
  ar ? (k === 'master' ? 'رسالة ماجستير' : k === 'phd' ? 'رسالة دكتوراه' : 'رسالة جامعية')
     : (k === 'master' ? "Master's thesis" : k === 'phd' ? 'Doctoral dissertation' : 'Thesis');

/* ---------------- التوليد ---------------- */
export function formatCitation(p: Paper, style: CitationStyle): Citation {
  const ar = hasArabic(p.title);
  const kind = kindOf(p);
  const names = p.authors.map((a) => parseName(a.name)).filter((n) => n.full && !/^(غير معروف|unknown)$/i.test(n.full));
  const authors = joinAuthors(names, style, ar);
  const title = p.title.trim().replace(/[.\s]+$/, '');
  const year = p.year ? String(p.year) : '';
  const url = link(p);
  const warnings: string[] = [];
  const sep = ar ? '،' : ',';

  if (!names.length) warnings.push('المؤلف غير متوفر في المصدر');
  if (!year) warnings.push('سنة النشر غير متوفرة');
  if (kind === 'article' && !p.venue) warnings.push('اسم المجلة غير متوفر');
  if (kind === 'article' && p.venue && !p.volume && !p.pages) warnings.push('المجلد/العدد/الصفحات غير متوفرة: أكملها من صفحة المصدر');
  if ((kind === 'master' || kind === 'phd' || kind === 'thesis') && !p.institution) warnings.push('اسم الجامعة غير متوفر');
  if (kind === 'book' && !p.publisher) warnings.push('اسم الناشر غير متوفر');

  const segs: Seg[] = [];
  const push = (t: string, i = false) => { if (t) segs.push(i ? { t, i } : { t }); };
  const vol = p.volume ? p.volume : '';
  const iss = p.issue ? p.issue : '';

  if (style === 'apa') {
    if (authors) push(`${endDot(authors)} `);
    push(`(${year || (ar ? 'د.ت' : 'n.d.')}). `);
    if (kind === 'article') {
      if (!authors) push(`${endDot(title)} `); else push(`${endDot(title)} `);
      if (p.venue) {
        push(p.venue, true);
        if (vol) { push(`${sep} `); push(vol, true); if (iss) push(`(${iss})`); }
        else if (iss) push(`${sep} (${iss})`);
        if (p.pages) push(`${sep} ${p.pages}`);
        push('. ');
      }
    } else if (kind === 'book') {
      push(title, true); push('. ');
      if (p.publisher) push(`${endDot(p.publisher)} `);
    } else {
      push(title, true);
      push(` [${thesisLabel(kind, ar)}${p.institution ? `${sep} ${p.institution}` : ''}]. `);
    }
    if (url) push(url);
  } else if (style === 'mla') {
    if (authors) push(`${endDot(authors)} `);
    if (kind === 'article') {
      push(`“${endDot(title)}” `);
      const bits = [vol && (ar ? `مج. ${vol}` : `vol. ${vol}`), iss && (ar ? `ع. ${iss}` : `no. ${iss}`), year, p.pages && (ar ? `ص. ${p.pages}` : `pp. ${p.pages}`)].filter(Boolean) as string[];
      if (p.venue) { push(p.venue, true); push(bits.length ? `${sep} ${bits.join(`${sep} `)}. ` : '. '); }
      else push(bits.length ? `${bits.join(`${sep} `)}. ` : '');
    } else if (kind === 'book') {
      push(title, true); push('. ');
      push([p.publisher, year].filter(Boolean).join(`${sep} `)); if (p.publisher || year) push('. ');
    } else {
      push(title, true); push(`. ${year ? `${year}. ` : ''}`);
      push(`${p.institution ? `${p.institution}${sep} ` : ''}${thesisLabel(kind, ar)}. `);
    }
    if (url) push(url.replace(/^https?:\/\//, 'https://') + '.');
  } else {
    // Chicago (قائمة المراجع)
    if (authors) push(`${endDot(authors)} `);
    if (kind === 'article') {
      push(`“${endDot(title)}” `);
      if (p.venue) {
        push(p.venue, true);
        if (vol) push(` ${vol}`);
        if (iss) push(`${vol ? `${sep} ` : ' '}${ar ? 'ع.' : 'no.'} ${iss}`);
        if (year) push(` (${year})`);
        if (p.pages) push(`: ${p.pages}`);
        push('. ');
      } else if (year) push(`${year}. `);
    } else if (kind === 'book') {
      push(title, true); push('. ');
      push([p.publisher, year].filter(Boolean).join(`${sep} `)); if (p.publisher || year) push('. ');
    } else {
      push(`“${endDot(title)}” ${thesisLabel(kind, ar)}${sep} ${p.institution ?? ''}${p.institution && year ? `${sep} ` : ''}${year}. `.replace(/\s+\./, '.'));
    }
    if (url) push(url + '.');
  }

  // دمج الأجزاء المتجاورة بنفس التنسيق وتنظيف المسافات
  const merged: Seg[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && Boolean(last.i) === Boolean(s.i)) last.t += s.t; else merged.push({ ...s });
  }
  const last = merged[merged.length - 1];
  if (last) last.t = last.t.replace(/\s+$/, '');
  const text = merged.map((s) => s.t).join('').replace(/\s{2,}/g, ' ').replace(/\.\./g, '.');
  const html = merged.map((s) => (s.i ? `<i>${esc(s.t)}</i>` : esc(s.t))).join('').replace(/\.\./g, '.');
  return { segs: merged, text, html, warnings, rtl: ar };
}

// الترتيب الهجائي لقائمة المراجع (مؤلف ثم سنة)، مع تفضيل الأسماء العربية بترتيب عربي
export function sortForBibliography(papers: Paper[]): Paper[] {
  const key = (p: Paper) => (p.authors[0] ? (parseName(p.authors[0].name).last || p.authors[0].name) : p.title).toLowerCase();
  return [...papers].sort((a, b) => key(a).localeCompare(key(b), hasArabic(key(a)) ? 'ar' : 'en') || a.year - b.year);
}

/* ---------------- BibTeX / RIS ---------------- */
const bib = (s: string): string => s.replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim();

export function toBibtex(papers: Paper[]): string {
  const used = new Set<string>();
  return papers.map((p) => {
    const a = p.authors[0] ? parseName(p.authors[0].name) : null;
    const base = (a && !a.arabic ? a.last : 'ref').replace(/[^A-Za-z0-9]/g, '') || 'ref';
    const word = (p.title.match(/[A-Za-z]{4,}/)?.[0] ?? 'work').toLowerCase();
    let key = `${base}${p.year || ''}${word}`;
    for (let n = 2; used.has(key); n++) key = `${base}${p.year || ''}${word}${n}`;
    used.add(key);
    const kind = kindOf(p);
    const type = kind === 'master' ? 'mastersthesis' : kind === 'phd' ? 'phdthesis' : kind === 'thesis' ? 'misc' : kind === 'book' ? 'book' : 'article';
    const f: [string, string | undefined][] = [
      ['author', p.authors.length ? p.authors.map((x) => bib(x.name)).join(' and ') : undefined],
      ['title', `{${bib(p.title)}}`],
      [kind === 'article' ? 'journal' : kind === 'book' ? 'publisher' : 'school', kind === 'article' ? p.venue : kind === 'book' ? p.publisher : p.institution],
      ['year', p.year ? String(p.year) : undefined],
      ['volume', p.volume], ['number', p.issue], ['pages', p.pages?.replace('–', '--')],
      ['doi', p.doi], ['url', p.sourceUrl], ['abstract', p.abstract ? bib(p.abstract).slice(0, 1200) : undefined]
    ];
    const body = f.filter(([, v]) => v).map(([k, v]) => `  ${k} = {${k === 'title' ? v : bib(v as string)}}`).join(',\n');
    return `@${type}{${key},\n${body}\n}`;
  }).join('\n\n');
}

export function toRis(papers: Paper[]): string {
  return papers.map((p) => {
    const kind = kindOf(p);
    const ty = kind === 'article' ? 'JOUR' : kind === 'book' ? 'BOOK' : 'THES';
    const lines: string[] = [`TY  - ${ty}`];
    p.authors.forEach((a) => lines.push(`AU  - ${a.name.replace(/\s+/g, ' ').trim()}`));
    lines.push(`TI  - ${p.title}`);
    if (p.year) lines.push(`PY  - ${p.year}`);
    if (p.venue) lines.push(`JO  - ${p.venue}`);
    if (p.volume) lines.push(`VL  - ${p.volume}`);
    if (p.issue) lines.push(`IS  - ${p.issue}`);
    if (p.pages) { const [sp, ep] = p.pages.split(/[–-]/); lines.push(`SP  - ${sp}`); if (ep) lines.push(`EP  - ${ep}`); }
    if (p.publisher) lines.push(`PB  - ${p.publisher}`);
    else if (p.institution) lines.push(`PB  - ${p.institution}`);
    if (p.doi) lines.push(`DO  - ${p.doi}`);
    if (p.sourceUrl) lines.push(`UR  - ${p.sourceUrl}`);
    if (p.abstract) lines.push(`AB  - ${p.abstract.replace(/\s+/g, ' ').slice(0, 1500)}`);
    lines.push('ER  - ');
    return lines.join('\n');
  }).join('\n\n');
}
