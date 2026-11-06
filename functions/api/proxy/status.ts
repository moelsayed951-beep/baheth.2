// GET /api/proxy/status — يخبر الواجهة أي الخدمات مفعّلة (قيم منطقية فقط، لا أسرار)
import { checkOrigin, json, type PagesHandler } from '../../_lib/shared';
import { aiAvailability } from '../../_lib/ai';
import { pickProvider } from '../../_lib/search';
import { authEnabled } from '../../_lib/auth';

export const onRequestGet: PagesHandler = ({ request, env }) => {
  const blocked = checkOrigin(request, env);
  if (blocked) return blocked;
  return json({ search: pickProvider(env), ai: aiAvailability(env), auth: authEnabled(env) ? { clientId: env.GOOGLE_CLIENT_ID } : null });
};
