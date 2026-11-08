// ترجمة استعلام البحث العربي إلى الإنجليزية لتوسيع البحث في القواعد العالمية (ERIC وPubMed وarXiv...).
// الترتيب: 1) القاموس المحلي إن غطّى كل الاستعلام  2) الخادم: Gemini (مفتاحك أو مفتاح المنصة) ثم MyMemory  3) ما عرفه القاموس جزئياً.
// الترجمة تُحفظ في ذاكرة الجلسة وفي كاش الخادم 24 ساعة.
import { callProxy } from '@/utils/proxy';
import { expandQuery } from '@/utils/queryExpander';
import { hasArabic } from '@/utils/text';
import { getKey } from '@/utils/userKeys';

const memo = new Map<string, Promise<string | undefined>>();

export function resolveEnglishQuery(query: string, signal?: AbortSignal): Promise<string | undefined> {
  const q = query.trim();
  if (!hasArabic(q)) return Promise.resolve(q || undefined);
  const dict = expandQuery(q);
  if (dict.complete && dict.english) return Promise.resolve(dict.english);

  const gemini = getKey('gemini');
  const memoKey = `${q}|${gemini ? 'k' : ''}`;
  let p = memo.get(memoKey);
  if (!p) {
    p = callProxy<{ text: string }>(`/api/proxy/translate?q=${encodeURIComponent(q)}`, {
      signal,
      timeoutMs: 20000,
      headers: gemini ? { 'X-User-Key': gemini } : undefined
    })
      .then((r) => r.text.trim() || dict.english || undefined)
      .catch(() => { memo.delete(memoKey); return dict.english || undefined; }); // فشل الترجمة لا يوقف البحث: نستعمل ما عرفه القاموس
    memo.set(memoKey, p);
  }
  return p;
}
