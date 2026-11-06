// ترجمة استعلام البحث العربي إلى الإنجليزية (عبر وسيط المنصة) لتوسيع البحث في القواعد العالمية.
// القاموس المحلي له الأولوية؛ الترجمة الآلية تُستخدم فقط لما لا يعرفه القاموس، وتُحفظ في ذاكرة الجلسة.
import { callProxy } from '@/utils/proxy';
import { expandQuery } from '@/utils/queryExpander';
import { hasArabic } from '@/utils/text';

const memo = new Map<string, Promise<string | undefined>>();

export function resolveEnglishQuery(query: string, signal?: AbortSignal): Promise<string | undefined> {
  const q = query.trim();
  if (!hasArabic(q)) return Promise.resolve(q || undefined);
  const dict = expandQuery(q).english;
  if (dict) return Promise.resolve(dict);
  let p = memo.get(q);
  if (!p) {
    p = callProxy<{ text: string }>(`/api/proxy/translate?q=${encodeURIComponent(q)}`, { signal, timeoutMs: 7000 })
      .then((r) => r.text.trim() || undefined)
      .catch(() => { memo.delete(q); return undefined; }); // فشل الترجمة لا يوقف البحث
    memo.set(q, p);
  }
  return p;
}
