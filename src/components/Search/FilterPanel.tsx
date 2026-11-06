import React from 'react';
import { ALL_DEPARTMENTS } from '@/data/departments';
import { EGYPTIAN_UNIVERSITIES } from '@/data/universities';
import type { AcademicDomain, TypeFilter } from '@/types';
import { cn } from '@/utils/cn';

export interface FilterValues {
  dept: string;
  uni: string;
  from: string;
  to: string;
  type: TypeFilter;
  oa: boolean;
  egypt: boolean;
}

interface Props {
  domain: AcademicDomain;
  values: FilterValues;
  onChange: (patch: Partial<FilterValues>) => void;
  onReset: () => void;
}

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1989 }, (_, i) => THIS_YEAR - i);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-xs font-bold text-stone-700 dark:text-stone-300">{children}</span>
);

export const FilterPanel: React.FC<Props> = ({ domain, values, onChange, onReset }) => {
  const depts = ALL_DEPARTMENTS.filter((d) => domain === 'all' || d.domain === domain);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <Label>الشعبة / القسم</Label>
        <select className="field" value={values.dept} onChange={(e) => onChange({ dept: e.target.value })}>
          <option value="">كل الأقسام</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>{d.nameAr}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <Label>الجامعة</Label>
        <select className="field" value={values.uni} onChange={(e) => onChange({ uni: e.target.value })}>
          <option value="">كل الجامعات</option>
          {EGYPTIAN_UNIVERSITIES.map((u) => (
            <option key={u.id} value={u.id}>{u.nameAr}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <Label>من سنة</Label>
          <select className="field" value={values.from} onChange={(e) => onChange({ from: e.target.value })}>
            <option value="">—</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>إلى سنة</Label>
          <select className="field" value={values.to} onChange={(e) => onChange({ to: e.target.value })}>
            <option value="">—</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>نوع البحث</Label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="نوع البحث">
          {([['all', 'الكل'], ['thesis', 'رسائل جامعية'], ['master', 'ماجستير'], ['phd', 'دكتوراه'], ['article', 'أبحاث'], ['book', 'كتب']] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              aria-pressed={values.type === val}
              onClick={() => onChange({ type: val })}
              className={cn('chip', values.type === val && 'chip-active')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" className="w-4 h-4 accent-academic-green" checked={values.oa} onChange={(e) => onChange({ oa: e.target.checked })} />
        <span>الوصول المفتوح فقط</span>
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" className="w-4 h-4 accent-academic-green" checked={values.egypt} onChange={(e) => onChange({ egypt: e.target.checked })} />
        <span>جهات مصرية فقط (افتراضي)</span>
      </label>

      <button type="button" onClick={onReset} className="btn-ghost self-start">إعادة ضبط الفلاتر</button>
    </div>
  );
};
