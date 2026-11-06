import React from 'react';

// عرض آمن لتنسيق Markdown البسيط الذي تُرجعه النماذج (عناوين، قوائم، **غامق**، `كود`)
// لا نستخدم dangerouslySetInnerHTML إطلاقاً: كل شيء يمر عبر React فيُهرَّب تلقائياً.
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={i} className="px-1 rounded bg-stone-100 dark:bg-stone-800 text-[0.85em]" dir="ltr">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

const UL = /^\s*[-*•]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const HEAD = /^\s*#{1,4}\s+(.*)$/;

export const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const ul = UL.exec(line);
    const ol = OL.exec(line);
    if (ul || ol) {
      const re = ul ? UL : OL;
      const items: string[] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      const Tag = ul ? 'ul' : 'ol';
      out.push(
        <Tag key={out.length} className={`${ul ? 'list-disc' : 'list-decimal'} ps-5 space-y-1`}>
          {items.map((it, k) => <li key={k} dir="auto">{inline(it)}</li>)}
        </Tag>
      );
      continue;
    }

    const head = HEAD.exec(line);
    if (head) {
      out.push(<p key={out.length} dir="auto" className="font-bold">{inline(head[1])}</p>);
      i++;
      continue;
    }

    // فقرة: نجمع الأسطر المتتالية غير الخاصة
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !UL.test(lines[i]) && !OL.test(lines[i]) && !HEAD.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(<p key={out.length} dir="auto">{inline(para.join(' '))}</p>);
  }
  return <div className="space-y-2 leading-relaxed">{out}</div>;
};
