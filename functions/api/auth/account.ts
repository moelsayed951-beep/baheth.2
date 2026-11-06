// DELETE /api/auth/account — يحذف حساب المستخدم وكل بياناته (المفضلة والحصة) نهائياً
import { HttpFail, json, toResponse, type D1Like, type PagesHandler } from '../../_lib/shared';
import { authEnabled, checkMutationOrigin, clearSessionCookie, requireSession } from '../../_lib/auth';

export const onRequestDelete: PagesHandler = async ({ request, env }) => {
  const blocked = checkMutationOrigin(request, env);
  if (blocked) return blocked;
  try {
    if (!authEnabled(env)) throw new HttpFail(503, 'auth_disabled', 'الحسابات غير مفعّلة على هذا الموقع');
    const s = await requireSession(request, env);
    const db = env.DB as D1Like;
    await db.prepare('DELETE FROM favorites WHERE user_sub = ?').bind(s.sub).run();
    await db.prepare('DELETE FROM usage WHERE user_sub = ?').bind(s.sub).run();
    await db.prepare('DELETE FROM users WHERE sub = ?').bind(s.sub).run();
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  } catch (err) {
    return toResponse(err);
  }
};
