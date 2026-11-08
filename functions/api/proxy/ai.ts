// ============================================================
// POST /api/proxy/ai
// الجسم: { provider: 'gemini'|'grok'|'openai'|'deepseek', messages: [{role, content}], doc?: {title, text, url?} }
// الرد:  { provider, model, text }
// الاتصال بأكثر من مزوّد في نفس الوقت يتم من الواجهة (Promise.allSettled)، وكل طلب هنا لمزوّد واحد
// حتى لا يُسقط فشلُ أحدها بقية الإجابات.
// ============================================================
import { HttpFail, checkOrigin, checkRateLimit, readUserKey, json, readJsonBody, toResponse, safeHttpUrl, type PagesHandler } from '../../_lib/shared';
import { globalCap, ipLimit, rateLimit } from '../../_lib/limits';
import { authEnabled, consumeQuota, requireSession } from '../../_lib/auth';
import { AI_PROVIDERS, RESEARCH_TASKS, runAi, type AiProviderId, type ChatTurn, type DocContext, type ResearchContext, type ResearchTask } from '../../_lib/ai';

const MAX_BODY = 90_000;
const MAX_RESEARCH_REFS = 12;
const MAX_RESEARCH_CHARS = 24_000;
const MAX_TURNS = 20;
const MAX_TURN_CHARS = 4_000;
const MAX_DOC_CHARS = 6_000; // نص المرجع للتلخيص: يكفي لفكرة البحث ويُسرّع الاستجابة

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function parseTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TURNS) throw new HttpFail(400, 'bad_messages', 'قائمة الرسائل غير صالحة');
  const turns: ChatTurn[] = raw.map((m) => {
    if (!isObj(m) || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      throw new HttpFail(400, 'bad_messages', 'صيغة الرسائل غير صالحة');
    }
    const content = m.content.trim().slice(0, MAX_TURN_CHARS);
    if (!content) throw new HttpFail(400, 'empty_message', 'رسالة فارغة');
    return { role: m.role, content };
  });
  if (turns[turns.length - 1].role !== 'user') throw new HttpFail(400, 'bad_messages', 'آخر رسالة يجب أن تكون من المستخدم');
  return turns;
}

// تقليم عند حدّ كلمة مع إشعار النموذج بالاقتطاع حتى لا يدّعي قراءة النص كاملاً
export function trimAtWord(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.8 ? lastSpace : max)}…\n[اقتُطع النص هنا لطوله]`;
}

function parseDoc(raw: unknown): DocContext | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObj(raw) || typeof raw.title !== 'string' || typeof raw.text !== 'string') throw new HttpFail(400, 'bad_doc', 'المرجع المرفق غير صالح');
  const url = typeof raw.url === 'string' ? safeHttpUrl(raw.url) ?? undefined : undefined;
  return { title: raw.title.slice(0, 500), text: trimAtWord(raw.text, MAX_DOC_CHARS), url };
}

// مراجع مساعد البحث: أرقامها تُعيَّن هنا (1..n) فلا يستطيع العميل تزييفها
export function parseResearch(raw: unknown): ResearchContext | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObj(raw) || typeof raw.task !== 'string' || !RESEARCH_TASKS.includes(raw.task as ResearchTask)) throw new HttpFail(400, 'bad_research', 'نوع المهمة غير معروف');
  const list = Array.isArray(raw.refs) ? raw.refs : [];
  if (list.length > MAX_RESEARCH_REFS) throw new HttpFail(400, 'too_many_refs', `الحد الأقصى ${MAX_RESEARCH_REFS} مرجعاً في الطلب الواحد`);
  let total = 0;
  const refs = list.map((r, i) => {
    if (!isObj(r) || typeof r.title !== 'string' || !r.title.trim()) throw new HttpFail(400, 'bad_ref', 'مرجع غير صالح');
    const ref = {
      n: i + 1,
      title: r.title.trim().slice(0, 400),
      authors: typeof r.authors === 'string' ? r.authors.slice(0, 300) : '',
      year: typeof r.year === 'string' || typeof r.year === 'number' ? String(r.year).slice(0, 4) : '',
      abstract: typeof r.abstract === 'string' ? r.abstract.replace(/\s+/g, ' ').trim().slice(0, 1500) : ''
    };
    total += ref.title.length + ref.authors.length + ref.abstract.length;
    return ref;
  });
  if (total > MAX_RESEARCH_CHARS) throw new HttpFail(413, 'refs_too_large', 'حجم المراجع كبير؛ قلّل عددها');
  if (raw.task === 'previous' && refs.length === 0) throw new HttpFail(400, 'refs_required', 'الدراسات السابقة تحتاج مرجعاً واحداً على الأقل من مكتبتك');
  return { task: raw.task as ResearchTask, refs };
}

export const onRequestPost: PagesHandler = async ({ request, env }) => {
  const blocked = checkOrigin(request, env);
  if (blocked) return blocked;

  try {
    const body = await readJsonBody(request, MAX_BODY);
    if (!isObj(body)) throw new HttpFail(400, 'bad_body', 'صيغة الطلب غير صحيحة');

    const provider = body.provider as AiProviderId;
    if (!AI_PROVIDERS.includes(provider)) throw new HttpFail(400, 'bad_provider', 'مزوّد الذكاء الاصطناعي غير معروف');

    // مفتاح المستخدم الخاص: لا حاجة لحد استخدام لأن التكلفة عليه. بدونه يُطبَّق الحد على مفاتيح الخادم (إن وُجدت)
    const userKey = readUserKey(request, 'X-User-Key');
    if (userKey) {
      await rateLimit(env, request, 'ai-own', 300, 3600); // مفتاح المستخدم: حد واسع يمنع فقط استخدام الوسيط كمرحّل
    } else {
      await rateLimit(env, request, 'ai', ipLimit(env, 'AI_IP_HOURLY', 60), 3600);
      if (authEnabled(env)) await consumeQuota(env, (await requireSession(request, env)).sub, 'ai'); // حصة يومية لكل حساب
      else await checkRateLimit(request, env, 'ai', 30, env.AI_HOURLY_LIMIT);
      await globalCap(env, 'ai');
    }
    const { text, model } = await runAi(provider, env, parseTurns(body.messages), parseDoc(body.doc), userKey, parseResearch(body.research));
    return json({ provider, model, text });
  } catch (err) {
    return toResponse(err);
  }
};
