// خدمة بحث الويب (كتب ومواقع) — تتصل بوسيط Cloudflare فقط: /api/proxy/google
// لا مفاتيح هنا. المفاتيح (GOOGLE_API_KEY, GOOGLE_CSE_ID, ...) على الخادم في functions/_lib/search.ts
import type { BackendStatus, WebResult, WebSearchPage } from '@/types/web';
import { callProxy } from '@/utils/proxy';
import { getKey } from '@/utils/userKeys';

interface RawHit { title: string; url: string; snippet: string; displayLink: string }
interface RawPage { provider: string; results: RawHit[]; nextStart: number | null }

function searchKeyHeader(): Record<string, string> | undefined {
  const k = getKey('tavily');
  return k ? { 'X-Search-Key': k } : undefined;
}

export interface WebSearchParams {
  query: string;
  sites: string[]; // نطاقات المكتبات المختارة؛ فارغة = الويب كله
  start?: number; // رقم أول نتيجة (1، 11، 21 ...)
  signal?: AbortSignal;
}

export async function searchWeb({ query, sites, start = 1, signal }: WebSearchParams): Promise<WebSearchPage> {
  const params = new URLSearchParams({ q: query, start: String(start) });
  if (sites.length) params.set('sites', sites.join(','));
  const data = await callProxy<RawPage>(`/api/proxy/google?${params.toString()}`, { signal, headers: searchKeyHeader() });
  const results: WebResult[] = data.results.map((r) => ({ ...r, id: r.url }));
  return { provider: data.provider, results, nextStart: data.nextStart };
}

// أي الخدمات مفعّلة على الخادم (لإخفاء/إظهار الأزرار بدل ترك المستخدم أمام أخطاء)
export function getBackendStatus(signal?: AbortSignal): Promise<BackendStatus> {
  return callProxy<BackendStatus>('/api/proxy/status', { signal, timeoutMs: 8000 });
}
