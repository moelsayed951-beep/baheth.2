import { describe, expect, it } from 'vitest';
import { formatCitation, sortForBibliography, toBibtex, toRis } from '@/utils/citations';
import type { Paper } from '@/types';

const base: Paper = {
  id: 'x', title: 'Effects of Online Learning on Achievement', authors: [{ name: 'John Michael Smith' }, { name: 'Jane Doe' }],
  year: 2021, abstract: '', publicationType: 'journal_article', source: 'openalex', sources: ['openalex'], domain: 'education',
  isOpenAccess: true, citationCount: 3, sourceUrl: 'https://example.org/p', doi: '10.1234/abc.5', venue: 'Journal of Education', volume: '12', issue: '3', pages: '45–67'
};

describe('APA', () => {
  it('مقال بمؤلفين', () => {
    const c = formatCitation(base, 'apa');
    expect(c.text).toBe('Smith, J. M., & Doe, J. (2021). Effects of Online Learning on Achievement. Journal of Education, 12(3), 45–67. https://doi.org/10.1234/abc.5');
    expect(c.segs.find((s) => s.i)?.t).toContain('Journal of Education');
    expect(c.warnings).toEqual([]);
  });
  it('ثلاثة مؤلفين', () => {
    const c = formatCitation({ ...base, authors: [{ name: 'A One' }, { name: 'B Two' }, { name: 'C Three' }] }, 'apa');
    expect(c.text.startsWith('One, A., Two, B., & Three, C. (2021).')).toBe(true);
  });
  it('أكثر من 20 مؤلفاً: أول 19 ثم ... ثم الأخير', () => {
    const authors = Array.from({ length: 22 }, (_, i) => ({ name: `First${i} Last${i}` }));
    const c = formatCitation({ ...base, authors }, 'apa');
    expect(c.text).toContain('. . . Last21, F.');
    expect(c.text).not.toContain('Last20,');
  });
  it('رسالة ماجستير', () => {
    const c = formatCitation({ ...base, publicationType: 'thesis_master', venue: undefined, institution: 'Cairo University', doi: undefined }, 'apa');
    expect(c.text).toContain("[Master's thesis, Cairo University]");
  });
  it('عربي: أسماء كاملة وتسمية الرسالة بالعربية', () => {
    const c = formatCitation({ ...base, title: 'أثر التعلم الإلكتروني في التحصيل', authors: [{ name: 'محمد أحمد علي' }, { name: 'سارة حسن' }], publicationType: 'thesis_phd', institution: 'جامعة عين شمس', venue: undefined, doi: undefined }, 'apa');
    expect(c.rtl).toBe(true);
    expect(c.text).toContain('محمد أحمد علي و سارة حسن');
    expect(c.text).toContain('[رسالة دكتوراه، جامعة عين شمس]');
  });
  it('تحذيرات الحقول الناقصة بدل اختلاقها', () => {
    const c = formatCitation({ ...base, authors: [], year: 0, venue: undefined, volume: undefined, pages: undefined, doi: undefined }, 'apa');
    expect(c.warnings).toEqual(expect.arrayContaining(['المؤلف غير متوفر في المصدر', 'سنة النشر غير متوفرة', 'اسم المجلة غير متوفر']));
    expect(c.text).toContain('(n.d.)');
  });
});

describe('MLA', () => {
  it('مقال: مؤلفان', () => {
    expect(formatCitation(base, 'mla').text).toBe('Smith, John Michael, and Jane Doe. “Effects of Online Learning on Achievement.” Journal of Education, vol. 12, no. 3, 2021, pp. 45–67. https://doi.org/10.1234/abc.5.');
  });
  it('ثلاثة مؤلفين => et al.', () => {
    const c = formatCitation({ ...base, authors: [{ name: 'A One' }, { name: 'B Two' }, { name: 'C Three' }] }, 'mla');
    expect(c.text.startsWith('One, A, et al.')).toBe(true);
  });
});

describe('Chicago', () => {
  it('مقال', () => {
    expect(formatCitation(base, 'chicago').text).toBe('Smith, John Michael, and Jane Doe. “Effects of Online Learning on Achievement.” Journal of Education 12, no. 3 (2021): 45–67. https://doi.org/10.1234/abc.5.');
  });
  it('كتاب', () => {
    const c = formatCitation({ ...base, publicationType: 'book', title: 'Teaching Methods', venue: undefined, publisher: 'Pearson', doi: undefined, sourceUrl: '' }, 'chicago');
    expect(c.text).toBe('Smith, John Michael, and Jane Doe. Teaching Methods. Pearson, 2021.');
  });
});

describe('ترتيب وتصدير', () => {
  it('الترتيب الهجائي', () => {
    const list = sortForBibliography([{ ...base, id: '1', authors: [{ name: 'Zed Young' }] }, { ...base, id: '2', authors: [{ name: 'Adam Brown' }] }]);
    expect(list.map((p) => p.id)).toEqual(['2', '1']);
  });
  it('BibTeX', () => {
    const b = toBibtex([base]);
    expect(b).toContain('@article{Smith2021effects,');
    expect(b).toContain('author = {John Michael Smith and Jane Doe}');
    expect(b).toContain('pages = {45--67}');
  });
  it('RIS', () => {
    const r = toRis([base]);
    expect(r).toContain('TY  - JOUR');
    expect(r).toContain('AU  - Jane Doe');
    expect(r).toContain('SP  - 45');
    expect(r).toContain('EP  - 67');
    expect(r.trim().endsWith('ER  -')).toBe(true);
  });
});
