// خدمة الذكاء الاصطناعي — تتصل بوسيط Cloudflare فقط: /api/proxy/ai
// المزوّدون: Gemini (الافتراضي) / Grok / OpenAI / DeepSeek. المفاتيح على الخادم.
import type { AiAnswer, AiDoc, AiProviderId, ChatTurn } from '@/types/web';
import { ProxyError, callProxy } from '@/utils/proxy';
import { getKey } from '@/utils/userKeys';

export const AI_LABELS: Record<AiProviderId, string> = {
  gemini: 'Google Gemini',
  grok: 'Grok (xAI)',
  openai: 'ChatGPT (OpenAI)',
  deepseek: 'DeepSeek'
};

// مفتاح المستخدم الخاص يُرسل في ترويسة طلب واحد فقط عبر HTTPS إلى وسيط المنصة
function userKeyHeader(provider: AiProviderId): Record<string, string> | undefined {
  const k = getKey(provider);
  return k ? { 'X-User-Key': k } : undefined;
}

interface AiReply { provider: AiProviderId; model: string; text: string }

export async function askAi(provider: AiProviderId, messages: ChatTurn[], doc?: AiDoc, signal?: AbortSignal): Promise<string> {
  // الخادم قد يجرّب أكثر من نموذج (حتى 55 ثانية)، فننتظر 70 ثانية. ونُقلّم نص المرجع من الجهة الأخرى لتسريع الرد
  const lean = doc ? { ...doc, text: doc.text.length > 6000 ? `${doc.text.slice(0, 6000)}…` : doc.text } : doc;
  const data = await callProxy<AiReply>('/api/proxy/ai', { method: 'POST', body: { provider, messages, doc: lean }, signal, timeoutMs: 70000, headers: userKeyHeader(provider) });
  return data.text;
}

export type ResearchTask = 'plan' | 'framework' | 'previous' | 'questions' | 'gap';
export interface ResearchRefInput { title: string; authors: string; year: string; abstract: string }

// مساعد البحث: مراجع الباحث فقط تُرسل، والخادم يرقّمها ويفرض قواعد عدم الاختلاق
export async function askResearch(provider: AiProviderId, task: ResearchTask, prompt: string, refs: ResearchRefInput[], signal?: AbortSignal): Promise<string> {
  const data = await callProxy<AiReply>('/api/proxy/ai', {
    method: 'POST',
    body: { provider, messages: [{ role: 'user', content: prompt }], research: { task, refs } },
    signal,
    timeoutMs: 100000,
    headers: userKeyHeader(provider)
  });
  return data.text;
}

// سؤال أكثر من مزوّد في نفس الوقت: فشل أحدها لا يمنع ظهور إجابات الباقي
export async function askMany(providers: AiProviderId[], messages: ChatTurn[], doc?: AiDoc, signal?: AbortSignal): Promise<AiAnswer[]> {
  const settled = await Promise.allSettled(providers.map((p) => askAi(p, messages, doc, signal)));
  return settled.map((r, i): AiAnswer => {
    const provider = providers[i];
    if (r.status === 'fulfilled') return { provider, ok: true, text: r.value };
    const error = r.reason instanceof ProxyError ? r.reason.message : 'تعذر الحصول على إجابة';
    return { provider, ok: false, error };
  });
}

// نص التلخيص الجاهز عند الضغط على «اسأل الذكاء الاصطناعي»
export const SUMMARIZE_PROMPT = 'لخّص هذا المرجع في نقاط موجزة: الفكرة الأساسية، وأهم ما يتناوله، ولمن يفيد. وبيّن بوضوح ما لا يمكن معرفته من المقتطف المتاح.';
