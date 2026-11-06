// POST /api/auth/logout — يمسح كوكي الجلسة
import { json, type PagesHandler } from '../../_lib/shared';
import { checkMutationOrigin, clearSessionCookie } from '../../_lib/auth';

export const onRequestPost: PagesHandler = ({ request, env }) => {
  const blocked = checkMutationOrigin(request, env);
  if (blocked) return blocked;
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
};
