// ============================================================
// GET /api/eric/...  ← وكيل ERIC على Cloudflare
// (كان على Netlify/Vercel يعمل عبر Rewrite في netlify.toml/vercel.json؛ Cloudflare Pages لا يدعم ذلك فنستبدله بدالة)
// ============================================================
import { checkOrigin, fail, fetchWithTimeout, toResponse, type PagesHandler } from '../../_lib/shared';

export const onRequestGet: PagesHandler = async ({ request, env }) => {
  const blocked = checkOrigin(request, env);
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const rest = url.pathname.replace(/^\/api\/eric\/?/, '');
    if (rest.includes('..')) return fail(400, 'bad_path', 'مسار غير صالح');
    const upstream = `https://api.ies.ed.gov/eric/${rest}${url.search}`;
    const res = await fetchWithTimeout(upstream, { headers: { Accept: 'application/json' } }, 12000);
    return new Response(res.body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'public, max-age=1800' }
    });
  } catch (err) {
    return toResponse(err);
  }
};
