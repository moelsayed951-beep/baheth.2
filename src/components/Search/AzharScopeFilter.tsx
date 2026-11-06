import React from 'react';
import { GraduationCap } from 'lucide-react';
import { AZHAR_DEPARTMENTS } from '@/utils/azhar';

interface Props {
  enabled: boolean;
  deptId: string;
  onChange: (patch: { enabled?: boolean; deptId?: string }) => void;
}

// فلتر جانبي: تقييد بحث الويب بكلية التربية بجامعة الأزهر وبقسم محدد
export const AzharScopeFilter: React.FC<Props> = ({ enabled, deptId, onChange }) => (
  <div className="flex flex-col gap-3">
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <input type="checkbox" className="w-4 h-4 mt-0.5 accent-academic-green" checked={enabled} onChange={(e) => onChange({ enabled: e.target.checked, deptId: e.target.checked ? deptId : '' })} />
      <span>
        <span className="font-semibold flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" />كلية التربية – جامعة الأزهر</span>
        <span className="block text-[11px] text-stone-500 dark:text-stone-400">أبحاث وكتب ورسائل ومجلات الكلية</span>
      </span>
    </label>

    {enabled && (
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-stone-700 dark:text-stone-300">القسم</span>
        <select className="field" value={deptId} onChange={(e) => onChange({ deptId: e.target.value })}>
          <option value="">كل الأقسام</option>
          {AZHAR_DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}
        </select>
      </label>
    )}

    {enabled && (
      <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
        التقييد بمطابقة نصية لاسم الكلية والقسم في صفحات الويب؛ فقد تفوتك نتائج لا يرد فيها الاسم بنفس الصيغة. ويُنصح بتفعيل «المجلات العلمية المصرية» من قائمة المكتبات.
      </p>
    )}
  </div>
);
