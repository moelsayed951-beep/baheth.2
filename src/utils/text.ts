import type { PublicationType, TypeFilter } from '@/types';

// توحيد النص العربي للمقارنة: حذف التشكيل والتطويل وتوحيد الألف والياء والتاء المربوطة
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function hasArabic(input: string): boolean {
  return /[\u0600-\u06FF]/.test(input);
}

// تقدير نوع المنشور (ماجستير/دكتوراه/مقال) من البيانات المتاحة
const BOOK_TYPES = new Set(['book', 'book-chapter', 'monograph', 'edited-book', 'reference-book', 'book-section', 'book-set']);

export function detectPublicationType(title: string, abstract: string, isThesis: boolean, rawType?: string): PublicationType {
  if (rawType && BOOK_TYPES.has(rawType.toLowerCase())) return 'book';
  const text = `${title} ${abstract}`.toLowerCase();
  if (isThesis || /ماجستير|دكتوراه|رسالة\s+علمية|\bthesis\b|\bdissertation\b/.test(text)) {
    if (/دكتوراه|ph\.?d|doctoral|doctorate/.test(text)) return 'thesis_phd';
    if (/ماجستير|master/.test(text)) return 'thesis_master';
    return 'thesis_other';
  }
  return 'journal_article';
}

export function isThesisType(t: PublicationType): boolean {
  return t === 'thesis_master' || t === 'thesis_phd' || t === 'thesis_other';
}

// مطابقة نوع المنشور مع فلتر النوع (ماجستير/دكتوراه/أبحاث/كتب)
export function matchesTypeFilter(t: PublicationType, f: TypeFilter): boolean {
  switch (f) {
    case 'all': return true;
    case 'thesis': return t === 'thesis_master' || t === 'thesis_phd' || t === 'thesis_other';
    case 'master': return t === 'thesis_master' || t === 'thesis_other';
    case 'phd': return t === 'thesis_phd' || t === 'thesis_other';
    case 'article': return t === 'journal_article';
    case 'book': return t === 'book';
  }
}
