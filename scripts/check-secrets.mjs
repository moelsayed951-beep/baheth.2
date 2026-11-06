// يفحص مجلد dist/ (ما يُرسل فعلياً للمتصفح) بحثاً عن أسرار أو أنماط مفاتيح معروفة. يفشل (exit 1) عند أي اكتشاف.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? 'dist';
const PATTERNS = [
  [/AIza[0-9A-Za-z_-]{35}/, 'مفتاح Google API'],
  [/(?<![A-Za-z0-9])sk-(?:proj-|svcacct-|ant-)?[A-Za-z0-9_-]{20,}/, 'مفتاح OpenAI/DeepSeek'],
  [/xai-[A-Za-z0-9]{20,}/, 'مفتاح xAI'],
  [/tvly-[A-Za-z0-9_-]{16,}/, 'مفتاح Tavily'],
  [/(?:SESSION_SECRET|XAI_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|DEEPSEEK_API_KEY|TAVILY_API_KEY|SERPER_API_KEY|CORE_API_KEY|NCBI_API_KEY)\s*[:=]\s*["'`][^"'`]{6,}/, 'اسم سر مع قيمة'],
  [/VITE_[A-Z_]*(?:API_KEY|SECRET|TOKEN)/, 'متغير VITE_ سري'],
  [/LEAKTEST[A-Za-z0-9]*/, 'قيمة اختبار تسريب']
];

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p); else yield p;
  }
}

let bad = 0, files = 0;
for (const f of walk(root)) {
  if (!/\.(js|css|html|map|json|txt|svg)$/.test(f)) continue;
  files++;
  const text = readFileSync(f, 'utf-8');
  for (const [re, label] of PATTERNS) {
    const m = text.match(re);
    if (m) { bad++; console.error(`✗ ${label} في ${f}: ${m[0].slice(0, 12)}…`); }
  }
}
if (bad) { console.error(`\nفشل: ${bad} اكتشاف في ${files} ملفاً`); process.exit(1); }
console.log(`✓ نظيف: فُحص ${files} ملفاً بلا أي أسرار`);
