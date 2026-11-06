import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { LIBRARY_PRESETS, MAX_SITES, libraryLabel, normalizeHost } from '@/utils/libraries';

interface Props {
  sites: string[]; // النطاقات المختارة؛ فارغة = الويب كله
  onChange: (sites: string[]) => void;
}

// فلتر جانبي لاختيار المكتبة (الشاملة، نور، ...) أو إضافة مكتبة أخرى بنطاقها
export const LibraryFilter: React.FC<Props> = ({ sites, onChange }) => {
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const presetHosts = LIBRARY_PRESETS.map((p) => p.host);
  const customSites = sites.filter((s) => !presetHosts.includes(s));

  const toggle = (host: string) => {
    setError('');
    if (sites.includes(host)) onChange(sites.filter((s) => s !== host));
    else if (sites.length >= MAX_SITES) setError(`الحد الأقصى ${MAX_SITES} مكتبات في كل بحث`);
    else onChange([...sites, host]);
  };

  const addCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const host = normalizeHost(custom);
    if (!host) { setError('اكتب نطاقاً صحيحاً مثل: waqfeya.net'); return; }
    if (sites.includes(host)) { setError('هذه المكتبة مضافة بالفعل'); return; }
    if (sites.length >= MAX_SITES) { setError(`الحد الأقصى ${MAX_SITES} مكتبات في كل بحث`); return; }
    setError('');
    setCustom('');
    onChange([...sites, host]);
  };

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">المكتبة</legend>
        {LIBRARY_PRESETS.map((p) => (
          <label key={p.host} className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="w-4 h-4 mt-0.5 accent-academic-green" checked={sites.includes(p.host)} onChange={() => toggle(p.host)} />
            <span>
              <span className="font-semibold">{p.label}</span>
              <span className="block text-[11px] text-stone-500 dark:text-stone-400">{p.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <form onSubmit={addCustom} className="flex flex-col gap-1.5">
        <label htmlFor="custom-site" className="text-xs font-bold text-stone-700 dark:text-stone-300">مكتبة أخرى (النطاق)</label>
        <div className="flex gap-1.5">
          <input id="custom-site" dir="ltr" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="example.com" className="field !py-2 flex-1 min-w-0" />
          <button type="submit" aria-label="إضافة المكتبة" className="btn-ghost !px-2.5"><Plus className="w-4 h-4" /></button>
        </div>
        {error && <p role="alert" className="text-[11px] text-red-700 dark:text-red-400">{error}</p>}
      </form>

      {customSites.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {customSites.map((s) => (
            <li key={s} className="chip chip-active !flex items-center gap-1.5">
              <span dir="ltr">{libraryLabel(s)}</span>
              <button type="button" onClick={() => toggle(s)} aria-label={`إزالة ${s}`}><X className="w-3 h-3" /></button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
        {sites.length === 0 ? 'لم تختر مكتبة: يُبحث في الويب كله.' : 'يُقيَّد البحث بالمكتبات المختارة فقط.'} النتائج من محرك بحث عام، فقد لا تظهر كل كتب المكتبة.
      </p>

      {sites.length > 0 && (
        <button type="button" onClick={() => { setError(''); onChange([]); }} className="btn-ghost self-start">البحث في الويب كله</button>
      )}
    </div>
  );
};
