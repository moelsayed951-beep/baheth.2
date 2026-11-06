export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// جلب JSON مع مهلة زمنية (Timeout) ودعم الإلغاء
export async function fetchJson<T>(
  url: string,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
  timeoutMs = 10000 // مهلة 10 ثوانٍ عبر AbortController
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', ...extraHeaders } });
    if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(signal?.aborted ? 'تم إلغاء الطلب' : 'انتهت مهلة الاتصال بالمصدر');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
