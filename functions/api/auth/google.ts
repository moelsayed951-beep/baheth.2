// POST /api/auth/google  { credential }  ← رمز Google ID من زر تسجيل الدخول
import { ipLimit, rateLimit } from '../../_lib/limits';
import { HttpFail, json, readJsonBody, toResponse, type D1Like, type PagesHandler } from '../../_lib/shared';
import { authEnabled, checkMutationOrigin, createSessionCookie, verifyGoogleIdToken } from '../../_lib/auth';

export const onRequestPost: PagesHandler = async ({ request, env }) => {
  const blocked = checkMutationOrigin(request, env);
  if (blocked) return blocked;
  try {
    await rateLimit(env, request, 'auth', ipLimit(env, 'AUTH_IP_HOURLY', 30), 3600);
    if (!authEnabled(env)) throw new HttpFail(503, 'auth_disabled', 'تسجيل الدخول غير مفعّل على هذا الموقع');
    const body = (await readJsonBody(request, 8000)) as { credential?: unknown };
    if (typeof body?.credential !== 'string' || body.credential.length > 4000) throw new HttpFail(400, 'bad_body', 'صيغة الطلب غير صحيحة');

    const user = await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID ?? '');
    await (env.DB as D1Like)
      .prepare('INSERT INTO users (sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture')
      .bind(user.sub, user.email, user.name, user.picture, Date.now())
      .run();
    return json({ user: { email: user.email, name: user.name, picture: user.picture } }, 200, { 'Set-Cookie': await createSessionCookie(env, user) });
  } catch (err) {
    return toResponse(err);
  }
};
