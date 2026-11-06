import { describe, expect, it } from 'vitest';
import { applyFilters, isVerifiedEgyptian } from '@/services/filters';
import { rankPapers } from '@/services/ranking';
import { deduplicate, filterAndSort } from '@/services/aggregator';
import { auditOutput, plainifyMarkdown } from '@/utils/citationGuard';
import { parseDois } from '@/services/doiImport';
import { normalizeData } from '@/services/normalize';
import { filters, paper } from './helpers/paper';

describe('فلتر السنوات', () => {
  const list = [paper({ id: 'a', year: 2015 }), paper({ id: 'b', year: 2022 }), paper({ id: 'c', year: 0 })];
  it('عند تحديد سنوات: يستبعد مجهولة السنة ويحسبها', () => {
    const r = applyFilters(list, filters({ yearStart: 2010, yearEnd: 2020 }));
    expect(r.papers.map((p) => p.id)).toEqual(['a']);
    expect(r.stats.hiddenUnknownYear).toBe(1);
  });
  it('بلا فلتر سنة: يبقي الجميع', () => {
    expect(applyFilters(list, filters()).papers).toHaveLength(3);
  });
  it('حد واحد فقط (من فقط) يستبعد مجهول السنة أيضاً', () => {
    expect(applyFilters(list, filters({ yearStart: 2020 })).papers.map((p) => p.id)).toEqual(['b']);
  });
});

describe('فلتر القسم يضمن الاقتصار عليه', () => {
  const autismAr = paper({ id: 'ar', title: 'فاعلية برنامج لذوي اضطراب طيف التوحد', abstract: '' });
  const autismEn = paper({ id: 'en', title: 'Inclusive education for children with autism', abstract: '' });
  const finance = paper({ id: 'fin', title: 'أثر الفائدة على سوق الأسهم', abstract: 'دراسة اقتصادية' });
  const learn = paper({ id: 'ld', title: 'دراسة عامة', abstract: 'تتناول صعوبات التعلم لدى التلاميذ' });
  it('يبقي المطابق عربياً وإنجليزياً وفي الملخص، ويستبعد غير ذي الصلة', () => {
    const r = applyFilters([autismAr, autismEn, finance, learn], filters({ departments: ['special_edu'] }));
    expect(r.papers.map((p) => p.id).sort()).toEqual(['ar', 'en', 'ld']);
    expect(r.stats.hiddenOffDepartment).toBe(1);
  });
  it('قسم شرعي لا يمرّر بحثاً تربوياً', () => {
    const r = applyFilters([autismAr, paper({ id: 'f', title: 'أحكام الزكاة في الفقه الإسلامي' })], filters({ departments: ['fiqh'] }));
    expect(r.papers.map((p) => p.id)).toEqual(['f']);
  });
});

describe('فلتر مصر يعتمد على التحقق من الجهة لا على نص الاستعلام', () => {
  it('يقبل: رمز دولة EG، جامعة مصرية معروفة، نطاق .eg، أو اسم جهة مصرية', () => {
    expect(isVerifiedEgyptian(paper({ countryCodes: ['EG'] }))).toBe(true);
    expect(isVerifiedEgyptian(paper({ universityId: 'cairo' }))).toBe(true);
    expect(isVerifiedEgyptian(paper({ sourceUrl: 'https://repository.mans.edu.eg/x' }))).toBe(true);
    expect(isVerifiedEgyptian(paper({ institution: 'Minia University, Egypt' }))).toBe(true);
  });
  it('يرفض: دولة أخرى، أو لا بيانات للتحقق (حتى لو العنوان يذكر مصر)', () => {
    expect(isVerifiedEgyptian(paper({ countryCodes: ['US'], institution: 'Harvard' }))).toBe(false);
    expect(isVerifiedEgyptian(paper({ title: 'التعليم في مصر Egypt', abstract: 'مصر' }))).toBe(false);
  });
  it('التطبيق مع إحصاء المخفي', () => {
    const r = applyFilters([paper({ id: 'y', countryCodes: ['EG'] }), paper({ id: 'n', title: 'Education in Egypt' })], filters({ egyptOnly: true }));
    expect(r.papers.map((p) => p.id)).toEqual(['y']);
    expect(r.stats.hiddenUnverifiedEgypt).toBe(1);
  });
});

describe('فلتر النوع', () => {
  it('thesis يشمل ماجستير ودكتوراه وغيرها فقط', () => {
    const l = [paper({ id: 'm', publicationType: 'thesis_master' }), paper({ id: 'p', publicationType: 'thesis_phd' }), paper({ id: 'j' }), paper({ id: 'b', publicationType: 'book' })];
    expect(applyFilters(l, filters({ typeFilter: 'thesis' })).papers.map((p) => p.id)).toEqual(['m', 'p']);
    expect(applyFilters(l, filters({ typeFilter: 'phd' })).papers.map((p) => p.id)).toEqual(['p']);
  });
});

describe('الترتيب العلمي الموحّد', () => {
  it('الصلة النصية فوق الاستشهادات الكثيرة لبحث بعيد عن الموضوع', () => {
    const rel = paper({ id: 'rel', title: 'أثر التعلم الإلكتروني في التحصيل الدراسي', abstract: 'دراسة عن التعلم الإلكتروني والتحصيل', citationCount: 2 });
    const off = paper({ id: 'off', title: 'تقنيات الري الحديثة في الزراعة', abstract: 'الري بالتنقيط', citationCount: 5000 });
    const part = paper({ id: 'part', title: 'التعلم في المرحلة الابتدائية', abstract: '', citationCount: 10 });
    const out = rankPapers([off, part, rel], 'التعلم الإلكتروني والتحصيل الدراسي');
    expect(out[0].id).toBe('rel');
    expect(out.map((p) => p.id).indexOf('off')).toBe(2);
  });
  it('ورود الكلمة في العنوان أقوى من الملخص، والإنجليزية بالترجمة', () => {
    const t = paper({ id: 't', title: 'Autism intervention programs', abstract: '' });
    const a = paper({ id: 'a', title: 'General study of programs', abstract: 'autism is mentioned once here' });
    expect(rankPapers([a, t], 'التوحد', 'autism')[0].id).toBe('t');
  });
  it('الاستشهادات تكسر التعادل لا أكثر', () => {
    const lo = paper({ id: 'lo', title: 'تعليم التفكير الناقد', citationCount: 1 });
    const hi = paper({ id: 'hi', title: 'تعليم التفكير الناقد', citationCount: 100 });
    expect(rankPapers([lo, hi], 'التفكير الناقد')[0].id).toBe('hi');
  });
  it('filterAndSort: relevance تستخدم الترتيب الموحّد وليس ترتيب الوصول', () => {
    const r = filterAndSort([paper({ id: 'x', title: 'زراعة' }), paper({ id: 'y', title: 'التربية الخاصة وصعوبات التعلم' })], filters({ query: 'التربية الخاصة' }), 'relevance');
    expect(r.papers[0].id).toBe('y');
  });
});

describe('إزالة التكرار', () => {
  it('بالـDOI (بغض النظر عن حالة الأحرف) وبالعنوان المتطابق، ويدمج المصادر', () => {
    const out = deduplicate([
      paper({ id: '1', title: 'Alpha study', doi: '10.1/A', sources: ['openalex'] }),
      paper({ id: '2', title: 'Different title', doi: '10.1/a', sources: ['crossref'], source: 'crossref' }),
      paper({ id: '3', title: 'ALPHA   Study' })
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sources.sort()).toEqual(['crossref', 'openalex']);
  });
  it('لا يدمج أبحاثاً مختلفة، ويتحمل آلاف النتائج بسرعة', () => {
    const w = 'alpha beta gamma delta kappa sigma omega theta lambda zeta curriculum teaching learning memory attention autism reading writing math science policy'.split(' ');
    let x = 7; const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    const seen = new Set<string>(); const list = [];
    while (list.length < 3000) { const t = Array.from({ length: 8 }, () => w[Math.floor(rnd() * w.length)]).join(' '); if (!seen.has(t)) { seen.add(t); list.push(paper({ id: String(list.length), title: t })); } }
    const t0 = Date.now();
    expect(deduplicate(list)).toHaveLength(3000);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

describe('حارس الاستشهادات (منع الاختلاق)', () => {
  const refs = [
    paper({ id: '1', title: 'أثر التعلم', authors: [{ name: 'محمد الشريف' }], year: 2020, doi: '10.5/real', sourceUrl: 'https://doi.org/10.5/real' }),
    paper({ id: '2', title: 'Inclusive education', authors: [{ name: 'Jane Smith' }], year: 2019, sourceUrl: 'https://example.org/inc' })
  ];
  it('نص سليم: إحالات صحيحة وتطابق (اسم، سنة)', () => {
    const r = auditOutput('أثبتت الدراسة [1] ما أكده (Smith, 2019). وكذلك [1، 2] و[1-2].', refs);
    expect(r.ok).toBe(true);
    expect(r.usedRefs).toEqual([1, 2]);
  });
  it('يكشف رقم إحالة غير موجود', () => {
    const r = auditOutput('كما في [3] و[1, 7]', refs);
    expect(r.ok).toBe(false);
    expect(r.invalidRefs).toEqual([3, 7]);
  });
  it('يكشف (مؤلف، سنة) مختلق، ويقبل المطابق فقط', () => {
    expect(auditOutput('(Brown, 2018) أكد ذلك', refs).suspiciousCitations).toEqual(['(Brown, 2018)']);
    expect(auditOutput('(Smith, 2021)', refs).suspiciousCitations).toHaveLength(1); // السنة لا تطابق
    expect(auditOutput('(الشريف، 2020)', refs).suspiciousCitations).toHaveLength(0);
  });
  it('يكشف DOI ورابطاً من خارج المراجع، ويقبل ما في المراجع', () => {
    const r = auditOutput('انظر 10.9999/fake و https://evil.example/paper وكذلك https://doi.org/10.5/real و10.5/real', refs);
    expect(r.foreignDois).toEqual(['10.9999/fake']);
    expect(r.foreignUrls).toEqual(['https://evil.example/paper']);
    expect(r.ok).toBe(false);
  });
  it('يرصد أرقام الصفحات وعلامات «بحاجة إلى مصدر» دون اعتبارها خطأً قاطعاً', () => {
    const r = auditOutput('ورد في ص 45 وفي p. 12-14 [بحاجة إلى مصدر] و[بحاجة إلى مصدر]', refs);
    expect(r.pageNumbers.length).toBe(2);
    expect(r.needsSource).toBe(2);
    expect(r.ok).toBe(true);
  });
  it('بلا مراجع: أي إحالة رقمية تُعدّ غير صالحة', () => {
    expect(auditOutput('كما في [1]', []).ok).toBe(false);
  });
  it('تنظيف Markdown', () => {
    expect(plainifyMarkdown('## عنوان\n**مهم** و *مائل*\n- بند\n\n\n\nنهاية')).toBe('عنوان\nمهم و مائل\n• بند\n\nنهاية');
  });
});

describe('استيراد DOI', () => {
  it('يستخرج من نص وروابط، بلا تكرار، وينظف الترقيم', () => {
    const t = 'راجع https://doi.org/10.1234/ABC.5). وكذلك doi:10.1234/abc.5, و 10.5555/xyz-9;';
    expect(parseDois(t)).toEqual(['10.1234/abc.5', '10.5555/xyz-9']);
  });
  it('نص بلا DOI', () => expect(parseDois('لا يوجد شيء')).toEqual([]));
  it('الحد الأقصى', () => expect(parseDois(Array.from({ length: 40 }, (_, i) => `10.1000/x${i}`).join(' '))).toHaveLength(30));
});

describe('توحيد البيانات', () => {
  it('المؤسسة لا تُستنتج من اسم المصدر، وبيانات التوثيق تُنقل', () => {
    const [p] = normalizeData([{ id: 'k', title: 'T', authors: ['A'], source: 'PubMed', year: '2020', type: 'article', url: 'https://x.org', provider: 'api', venue: 'J Med', volume: '3' }], 'pubmed', 'all');
    expect(p.institution).toBeUndefined();
    expect(p).toMatchObject({ venue: 'J Med', volume: '3', sourceLabel: 'PubMed', year: 2020 });
  });
});
