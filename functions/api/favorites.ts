// GET /api/favorites  |  POST /api/favorites {paper}  |  DELETE /api/favorites?id=...
// المفضلة خاصة بكل حساب (D1). نخزّن نسخة منقّاة من بيانات الورقة فقط.
import { HttpFail, checkOrigin, json, readJsonBody, safeHttpUrl, toResponse, type D1Like, type PagesHandler } from '../_lib/shared';
import { ipLimit, rateLimit } from '../_lib/limits';
import { authEnabled, checkMutationOrigin, requireSession } from '../_lib/auth';

const MAX_FAVORITES = 500;
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function sanitize(p: unknown): { id: string; data: string } {
  if (!isObj(p)) throw new HttpFail(400, 'bad_paper', 'بيانات الورقة غير صالحة');
  const id = str(p.id, 300);
  const title = str(p.title, 500);
  const sourceUrl = typeof p.sourceUrl === 'string' ? safeHttpUrl(p.sourceUrl) : null;
  if (!id || !title || !sourceUrl) throw new HttpFail(400, 'bad_paper', 'بيانات الورقة غير صالحة');
  const authors = Array.isArray(p.authors) ? p.authors.slice(0, 20).map((a) => ({ name: str(isObj(a) ? a.name : '', 120) })).filter((a) => a.name) : [];
  const sources = Array.isArray(p.sources) ? p.sources.slice(0, 10).map((s) => str(s, 40)).filter(Boolean) : [];
  const clean = {
    id, title, authors, sourceUrl,
    year: Number.isFinite(Number(p.year)) ? Number(p.year) : 0,
    abstract: str(p.abstract, 1500),
    publicationType: str(p.publicationType, 30) || 'journal_article',
    source: str(p.source, 40), sources,
    doi: str(p.doi, 120) || undefined,
    institution: str(p.institution, 200) || undefined,
    universityId: str(p.universityId, 60) || undefined,
    domain: str(p.domain, 20) || 'all',
    pdfUrl: typeof p.pdfUrl === 'string' ? safeHttpUrl(p.pdfUrl) ?? undefined : undefined,
    isOpenAccess: Boolean(p.isOpenAccess),
    citationCount: Number.isFinite(Number(p.citationCount)) ? Number(p.citationCount) : 0,
    provider: p.provider === 'web-search' ? 'web-search' : p.provider === 'api' ? 'api' : undefined,
    sourceLabel: str(p.sourceLabel, 120) || undefined,
    venue: str(p.venue, 250) || undefined,
    publisher: str(p.publisher, 250) || undefined,
    volume: str(p.volume, 30) || undefined,
    issue: str(p.issue, 30) || undefined,
    pages: str(p.pages, 40) || undefined,
    countryCodes: Array.isArray(p.countryCodes) ? p.countryCodes.slice(0, 6).map((c) => str(c, 3)).filter(Boolean) : undefined
  };
  return { id, data: JSON.stringify(clean) };
}

const cleanNote = (v: unknown): string => str(v, 2000);

interface Row { data: string; note: string; created_at: number }

export const onRequestGet: PagesHandler = async ({ request, env }) => {
  const blocked = checkOrigin(request, env);
  if (blocked) return blocked;
  try {
    if (!authEnabled(env)) throw new HttpFail(503, 'auth_disabled', 'الحسابات غير مفعّلة على هذا الموقع');
    const s = await requireSession(request, env);
    const rows = (await (env.DB as D1Like).prepare('SELECT data, note, created_at FROM favorites WHERE user_sub = ? ORDER BY created_at DESC LIMIT ?').bind(s.sub, MAX_FAVORITES).all<Row>()).results;
    return json({ items: rows.map((r) => ({ paper: JSON.parse(r.data) as unknown, note: r.note ?? '', addedAt: r.created_at })) });
  } catch (err) {
    return toResponse(err);
  }
};

// إضافة مرجع واحد {paper, note?} أو دفعة {papers: [...]} (حتى 50) لرفع مكتبة الجهاز إلى الحساب
export const onRequestPost: PagesHandler = async ({ request, env }) => {
  const blocked = checkMutationOrigin(request, env);
  if (blocked) return blocked;
  try {
    await rateLimit(env, request, 'library', ipLimit(env, 'LIBRARY_IP_HOURLY', 600), 3600);
    if (!authEnabled(env)) throw new HttpFail(503, 'auth_disabled', 'الحسابات غير مفعّلة على هذا الموقع');
    const s = await requireSession(request, env);
    const body = await readJsonBody(request, 400_000);
    const b = isObj(body) ? body : {};
    const inputs: { paper: unknown; note: string }[] = Array.isArray(b.papers)
      ? b.papers.slice(0, 50).map((x) => ({ paper: isObj(x) && 'paper' in x ? x.paper : x, note: isObj(x) ? cleanNote(x.note) : '' }))
      : [{ paper: b.paper, note: cleanNote(b.note) }];
    const clean = inputs.map((i) => ({ ...sanitize(i.paper), note: i.note }));

    const db = env.DB as D1Like;
    const c = await db.prepare('SELECT COUNT(*) AS n FROM favorites WHERE user_sub = ?').bind(s.sub).first<{ n: number }>();
    let count = c?.n ?? 0;
    let added = 0;
    for (const item of clean) {
      const exists = await db.prepare('SELECT 1 AS x FROM favorites WHERE user_sub = ? AND paper_id = ?').bind(s.sub, item.id).first();
      if (!exists) {
        if (count >= MAX_FAVORITES) { if (clean.length === 1) throw new HttpFail(400, 'favorites_full', `بلغت الحد الأقصى للمكتبة (${MAX_FAVORITES}). احذف بعضها أولاً.`); continue; }
        count++;
      }
      await db.prepare('INSERT INTO favorites (user_sub, paper_id, data, note, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_sub, paper_id) DO UPDATE SET data = excluded.data, note = CASE WHEN excluded.note = \'\' THEN favorites.note ELSE excluded.note END').bind(s.sub, item.id, item.data, item.note, Date.now()).run();
      added++;
    }
    return json({ ok: true, added });
  } catch (err) {
    return toResponse(err);
  }
};

// تعديل ملاحظة مرجع: {id, note}
export const onRequestPut: PagesHandler = async ({ request, env }) => {
  const blocked = checkMutationOrigin(request, env);
  if (blocked) return blocked;
  try {
    if (!authEnabled(env)) throw new HttpFail(503, 'auth_disabled', 'الحسابات غير مفعّلة على هذا الموقع');
    const s = await requireSession(request, env);
    const b = await readJsonBody(request, 6000);
    const id = isObj(b) ? str(b.id, 300) : '';
    if (!id) throw new HttpFail(400, 'bad_id', 'معرّف غير صالح');
    await (env.DB as D1Like).prepare('UPDATE favorites SET note = ? WHERE user_sub = ? AND paper_id = ?').bind(cleanNote(isObj(b) ? b.note : ''), s.sub, id).run();
    return json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
};

export const onRequestDelete: PagesHandler = async ({ request, env }) => {
  const blocked = checkMutationOrigin(request, env);
  if (blocked) return blocked;
  try {
    if (!authEnabled(env)) throw new HttpFail(503, 'auth_disabled', 'الحسابات غير مفعّلة على هذا الموقع');
    const s = await requireSession(request, env);
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!id || id.length > 300) throw new HttpFail(400, 'bad_id', 'معرّف غير صالح');
    await (env.DB as D1Like).prepare('DELETE FROM favorites WHERE user_sub = ? AND paper_id = ?').bind(s.sub, id).run();
    return json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
};
