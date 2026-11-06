import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { clearAllKeys, isRemembered, isValidKey, setKey, setRemember, useUserKeys, type KeyId } from '@/utils/userKeys';

interface KeyInfo { id: KeyId; label: string; purpose: string; url: string; note: string }

const KEYS: KeyInfo[] = [
  { id: 'gemini', label: 'Google Gemini', purpose: 'المساعد الذكي', url: 'https://aistudio.google.com/apikey', note: 'يوفّر حصة مجانية للمفاتيح الشخصية (راجع الشروط الحالية). الأنسب للبداية.' },
  { id: 'grok', label: 'Grok (xAI)', purpose: 'المساعد الذكي', url: 'https://console.x.ai', note: 'يحتاج رصيداً في حسابك لدى xAI.' },
  { id: 'openai', label: 'OpenAI', purpose: 'المساعد الذكي', url: 'https://platform.openai.com/api-keys', note: 'يحتاج رصيداً في حسابك لدى OpenAI.' },
  { id: 'deepseek', label: 'DeepSeek', purpose: 'المساعد الذكي', url: 'https://platform.deepseek.com/api_keys', note: 'تكلفته منخفضة عادةً؛ يحتاج رصيداً.' },
  { id: 'tavily', label: 'Tavily', purpose: 'البحث في المكتبات العربية والناشرين', url: 'https://app.tavily.com', note: 'له حصة مجانية شهرية. بدونه قد تتوقف نتائج المكتبات العربية إذا نفدت حصة المنصة.' }
];

const KeyRow: React.FC<{ info: KeyInfo; saved?: string }> = ({ info, saved }) => {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');

  const save = () => {
    if (!isValidKey(val)) { setErr('صيغة المفتاح غير صالحة: تأكد من نسخه كاملاً بدون مسافات.'); return; }
    setKey(info.id, val);
    setVal('');
    setErr('');
  };

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-stone-900 dark:text-stone-100">{info.label} <span className="text-xs font-normal text-stone-500 dark:text-stone-400">· {info.purpose}</span></h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">{info.note}</p>
        </div>
        <a href={info.url} target="_blank" rel="noreferrer" className="text-xs underline text-academic-green dark:text-academic-gold">احصل على مفتاح</a>
      </div>
      {saved ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-emerald-700 dark:text-emerald-400">✓ محفوظ في متصفحك (<span dir="ltr" className="font-mono">…{saved.slice(-4)}</span>)</span>
          <button type="button" onClick={() => setKey(info.id, '')} className="btn-ghost !py-1.5 !px-3 text-xs"><Trash2 className="w-3.5 h-3.5" />حذف</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input type="password" dir="ltr" autoComplete="off" spellCheck={false} value={val} onChange={(e) => setVal(e.target.value)} placeholder="الصق المفتاح هنا" aria-label={`مفتاح ${info.label}`} className="field flex-1 font-mono text-sm" />
          <button type="button" onClick={save} disabled={!val.trim()} className="btn-primary !px-4">حفظ</button>
        </div>
      )}
      {err && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const keys = useUserKeys();
  const { user, quota, deleteAccount } = useAuth();
  const [remember, setRememberState] = useState(isRemembered());
  const [delMsg, setDelMsg] = useState('');
  const any = Object.values(keys).some(Boolean);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold font-tajawal text-stone-900 dark:text-stone-100 flex items-center gap-2"><KeyRound className="w-6 h-6 text-academic-gold" />مفاتيحي</h1>
        <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-300">
          البحث الأكاديمي مجاني للجميع. أما المساعد الذكي فيعمل بمفتاحك أنت، فتكون تكلفته على حسابك وبحسب استخدامك أنت. أضف مفتاح مزوّد واحد على الأقل (يكفي Gemini للبداية).
        </p>
      </header>

      {user && quota && (
        <div className="card p-4 text-sm flex flex-col gap-1">
          <h2 className="font-bold text-stone-900 dark:text-stone-100">حصتك اليومية من خدمات المنصة</h2>
          <p className="text-stone-600 dark:text-stone-300">بحث المكتبات العربية: {quota.web.used} / {quota.web.limit}</p>
          <p className="text-stone-600 dark:text-stone-300">المساعد الذكي (إن وُفّر بمفتاح المنصة): {quota.ai.used} / {quota.ai.limit}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">تتجدد يومياً (بتوقيت UTC). مفتاحك الخاص لا يُحسب عليك من هذه الحصة.</p>
        </div>
      )}

      <div className="card p-4 text-xs leading-6 text-stone-600 dark:text-stone-300 border-amber-300 dark:border-amber-800">
        <strong>الأمان:</strong> لا نخزّن مفتاحك في أي خادم؛ يُرسل مع كل طلب عبر HTTPS إلى وسيط المنصة ثم إلى المزوّد مباشرة. <strong>افتراضياً يُمحى المفتاح بإغلاق التبويب.</strong> لا تفعّل «التذكّر» على جهاز عام أو مشترك، وأنشئ مفتاحاً مخصصاً لهذه المنصة بحد إنفاق منخفض من لوحة المزوّد، واحذفه من هنا أو من لوحة المزوّد متى شئت.
      </div>

      {KEYS.map((k) => <KeyRow key={k.id} info={k} saved={keys[k.id]} />)}

      <label className="flex items-start gap-2 text-xs text-stone-600 dark:text-stone-300">
        <input type="checkbox" className="mt-0.5 w-4 h-4 accent-academic-green" checked={remember} onChange={(e) => { setRememberState(e.target.checked); setRemember(e.target.checked); }} />
        <span>تذكّر مفاتيحي على هذا الجهاز (تُحفظ في المتصفح حتى تحذفها). اتركه مُعطَّلاً على الأجهزة المشتركة.</span>
      </label>

      {any && <button type="button" onClick={clearAllKeys} className="btn-ghost self-start"><Trash2 className="w-4 h-4" />حذف كل المفاتيح من هذا المتصفح</button>}
      {user && (
        <section className="card p-4 flex flex-col gap-2 border-red-200 dark:border-red-900">
          <h2 className="font-bold text-sm text-stone-900 dark:text-stone-100">حذف الحساب</h2>
          <p className="text-xs leading-6 text-stone-600 dark:text-stone-300">يحذف نهائياً بريدك وبياناتك ومكتبتك المحفوظة في حسابك وعدّادات استهلاكك من خوادمنا. لا يمكن التراجع. مكتبتك المحلية على هذا الجهاز لا تتأثر.</p>
          <button
            type="button"
            className="btn-ghost self-start text-red-700 dark:text-red-400"
            onClick={() => {
              if (!window.confirm('سيُحذف حسابك وكل ما حفظته فيه نهائياً. هل أنت متأكد؟')) return;
              deleteAccount().then(() => setDelMsg('تم حذف حسابك وبياناتك.')).catch((e: unknown) => setDelMsg(e instanceof Error ? e.message : 'تعذر حذف الحساب'));
            }}
          >
            <Trash2 className="w-4 h-4" />حذف حسابي وكل بياناتي
          </button>
        </section>
      )}
      {delMsg && <p role="status" className="text-sm text-academic-green dark:text-academic-gold">{delMsg}</p>}
      <Link to="/" className="btn-primary self-center">العودة للرئيسية</Link>
    </main>
  );
};
