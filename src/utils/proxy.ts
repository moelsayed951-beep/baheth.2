// عميل موحّد لوسطاء Cloudflare (/api/proxy/*). لا يحتوي أي مفاتيح؛ المفاتيح على الخادم فقط.
export class ProxyError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ProxyError';
    this.status = status;
    this.code = code;
  }
}

interface CallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export async function callProxy<T>(path: string, { method = 'GET', body, signal, timeoutMs = 20000, headers }: CallOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(path, {
      method,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const raw = await res.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      /* الرد ليس JSON (مثلاً صفحة خطأ من الاستضافة) */
    }
    if (!res.ok) {
      const d = data as { error?: string; code?: string } | null;
      // أثناء التطوير بـ vite وحده لا توجد دوال Cloudflare، فيُرجع الخادم HTML أو 404
      const message = d?.error ?? (res.status === 404 ? 'الخدمة غير متاحة في هذه البيئة (تعمل على Cloudflare Pages أو wrangler فقط).' : `تعذر الاتصال بالخدمة (HTTP ${res.status})`);
      throw new ProxyError(res.status, d?.code ?? 'http', message);
    }
    if (data === null) throw new ProxyError(502, 'bad_response', 'رد غير متوقع من الخدمة');
    return data as T;
  } catch (err) {
    if (err instanceof ProxyError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ProxyError(0, signal?.aborted ? 'aborted' : 'timeout', signal?.aborted ? 'تم إلغاء الطلب' : 'انتهت مهلة الاتصال');
    }
    throw new ProxyError(0, 'network', 'تعذر الاتصال بالخادم، تحقق من الإنترنت');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
