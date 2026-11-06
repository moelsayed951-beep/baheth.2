// إعدادات البيئة (راجع .env.example)
export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL ?? '';
export const ERIC_API_BASE: string = import.meta.env.VITE_ERIC_API_BASE ?? '/api/eric';
// ملاحظة أمنية: لا توجد هنا أي مفاتيح. مفتاح CORE وغيره من الأسرار على الخادم فقط (functions/)
