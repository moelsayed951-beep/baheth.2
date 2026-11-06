// نطاق «كلية التربية – جامعة الأزهر» في بحث الويب.
// ملاحظة: واجهات البحث الأكاديمي نادراً ما تذكر الكلية أو القسم، لذلك يُطبَّق هذا النطاق
// على بحث الويب بإضافة عبارات نصية إلى الاستعلام (مطابقة نصية، وليست فهرساً رسمياً للكلية).
import { ALL_DEPARTMENTS } from '@/data/departments';

export const AZHAR_FACULTY_TERMS = '"جامعة الأزهر" "كلية التربية"';

export const AZHAR_DEPARTMENTS = ALL_DEPARTMENTS.filter((d) => d.domain === 'education');

// يبني الاستعلام الفعلي المرسل للوسيط
export function buildScopedQuery(query: string, azhar: boolean, deptId: string): string {
  const parts = [query.trim()];
  if (azhar) parts.push(AZHAR_FACULTY_TERMS);
  const dept = AZHAR_DEPARTMENTS.find((d) => d.id === deptId);
  if (azhar && dept) parts.push(`"${dept.nameAr}"`);
  return parts.join(' ');
}
