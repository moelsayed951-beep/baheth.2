// اختبار دخان حي على موقعك المنشور:  node scripts/smoke.mjs https://your-site.pages.dev
// يتحقق من الإعداد والمصادر والحمايات. لا يستهلك حصة مدفوعة (أقل من 10 طلبات).
const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) { console.error('الاستخدام: node scripts/smoke.mjs https://موقعك'); process.exit(2); }

const results = [];
const check = async (name, fn) => {
  try { const r = await fn(); results.push({ name, ok: r === true || r === undefined, detail: typeof r === 'string' ? r : '' }); }
  catch (e) { results.push({ name, ok: false, detail: String(e.message ?? e) }); }
};
const get = (p, init) => fetch(base + p, { headers: { Accept: 'application/json' }, ...init });
const j = async (p, init) => { const r = await get(p, init); return { status: r.status, headers: r.headers, body: await r.json().catch(() => null) }; };

await check('الصفحة الرئيسية تعمل', async () => (await get('/')).status === 200);
await check('ترويسات الأمان موجودة', async () => {
  const h = (await get('/')).headers;
  const need = ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'strict-transport-security'];
  const miss = need.filter((n) => !h.get(n));
  return miss.length ? `ناقص: ${miss.join(', ')}` : true;
});
await check('/api/proxy/status يعمل ولا يكشف أسراراً', async () => {
  const r = await j('/api/proxy/status');
  if (r.status !== 200) return `status ${r.status}`;
  const txt = JSON.stringify(r.body);
  if (/sk-|AIza|tvly-|SESSION_SECRET/.test(txt)) return 'تسريب محتمل';
  return `search=${r.body.search} auth=${r.body.auth ? 'on' : 'off'} ai=${Object.entries(r.body.ai).filter(([, v]) => v).map(([k]) => k).join(',') || 'none'}`;
});
for (const src of ['doaj', 'europepmc', 'zenodo', 'hal', 'arxiv', 'pubmed']) {
  await check(`مصدر ${src}`, async () => { const r = await j(`/api/proxy/source?src=${src}&q=education`); return r.status === 200 && Array.isArray(r.body?.results) ? `${r.body.results.length} نتيجة` : `status ${r.status}: ${r.body?.error ?? ''}`; });
}
await check('مصدر core (يحتاج CORE_API_KEY)', async () => { const r = await j('/api/proxy/source?src=core&q=education'); return r.status === 200 ? `${r.body.results.length} نتيجة` : r.status === 503 ? 'غير مفعّل (اختياري)' : `status ${r.status}`; });
await check('مصدر base (يحتاج تسجيل IP)', async () => { const r = await j('/api/proxy/source?src=base&q=education'); return r.status === 200 ? `${r.body.results.length} نتيجة` : `status ${r.status}: ${r.body?.error ?? ''}`; });
await check('الترجمة', async () => { const r = await j('/api/proxy/translate?q=' + encodeURIComponent('التعليم الدامج')); return r.status === 200 && r.body.text ? r.body.text : `status ${r.status}`; });
await check('رفض مصدر غير معروف (400)', async () => (await j('/api/proxy/source?src=evil&q=a')).status === 400);
await check('رفض طلب من موقع آخر (403)', async () => (await get('/api/proxy/source?src=doaj&q=a', { headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' } })).status === 403);
await check('المفضلة تتطلب دخولاً (401/503)', async () => [401, 503].includes((await j('/api/favorites')).status));
await check('الطلبات المعدِّلة بلا Origin مرفوضة', async () => [403, 503].includes((await get('/api/favorites', { method: 'POST', body: '{}' })).status));
await check('المساعد بلا مفتاح لا يعمل (503/401)', async () => [401, 503].includes((await j('/api/proxy/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ provider: 'gemini', messages: [{ role: 'user', content: 'hi' }] }) })).status));

let failed = 0;
for (const r of results) { console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`); if (!r.ok) failed++; }
console.log(`\n${results.length - failed}/${results.length} نجح`);
process.exit(failed ? 1 : 0);
