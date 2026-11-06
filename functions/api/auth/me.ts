// GET /api/auth/me → { user: {...}|null, quota }
import { checkOrigin, json, toResponse, type PagesHandler } from '../../_lib/shared';
import { getSession, usageToday } from '../../_lib/auth';

export const onRequestGet: PagesHandler = async ({ request, env }) => {
  const blocked = checkOrigin(request, env);
  if (blocked) return blocked;
  try {
    const s = await getSession(request, env);
    if (!s) return json({ user: null });
    return json({ user: { email: s.email, name: s.name, picture: s.picture }, quota: await usageToday(env, s.sub) });
  } catch (err) {
    return toResponse(err);
  }
};
