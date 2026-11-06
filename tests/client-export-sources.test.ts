import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { buildDocx, buildPrintHtml, type ExportDoc } from '@/utils/exporters';
import { buildBibliographyDoc } from '@/utils/bibliography';
import { formatCitation } from '@/utils/citations';
import { searchOpenAlex } from '@/services/sources/openalex';
import { searchCrossref } from '@/services/sources/crossref';
import { searchSemanticScholar } from '@/services/sources/semanticscholar';
import { filters, paper } from './helpers/paper';

afterEach(() => vi.unstubAllGlobals());

const docx = async (doc: ExportDoc) => {
  const buf = await Packer.toBuffer(await buildDocx(doc));
  const zip = await JSZip.loadAsync(buf);
  return { names: Object.keys(zip.files), xml: await zip.file('word/document.xml')!.async('string') };
};

describe('تصدير Word (.docx حقيقي)', () => {
  const arPaper = paper({ id: '1', title: 'أثر التعلم الإلكتروني', authors: [{ name: 'محمد علي' }], year: 2021, publicationType: 'thesis_master', institution: 'جامعة القاهرة', abstract: '' });
  const enPaper = paper({ id: '2', title: 'Online Learning Effects', authors: [{ name: 'Jane Smith' }], venue: 'Journal of Ed', volume: '3', pages: '1–9' });

  it('ملف صالح بصيغة zip يحوي document.xml، بنص عربي ومعلّق وRTL', async () => {
    const { names, xml } = await docx(buildBibliographyDoc([arPaper, enPaper], 'apa'));
    expect(names).toEqual(expect.arrayContaining(['word/document.xml', '[Content_Types].xml']));
    expect(xml).toContain('أثر التعلم الإلكتروني');
    expect(xml).toContain('Online Learning Effects');
    expect(xml).toMatch(/<w:bidi\s*\/>/);
    expect(xml).toMatch(/<w:rtl\s*\/>/);
    expect(xml).toContain('w:hanging="720"');
    expect(xml).toMatch(/<w:i\s*\/>/); // أسماء المجلات/العناوين مائلة
    expect(xml).toContain('رسالة ماجستير');
  });
  it('تتضمن ملاحظات الباحث عند الطلب وتحذير المراجعة', async () => {
    const { xml } = await docx(buildBibliographyDoc([arPaper], 'mla', new Map([['1', 'ملاحظة مهمة جداً']])));
    expect(xml).toContain('ملاحظة مهمة جداً');
    expect(xml).toContain('راجعها مع المصدر الأصلي');
  });
});

describe('تصدير PDF (HTML الطباعة)', () => {
  it('اتجاه RTL وتنسيق مائل ومعلّق، ويهرّب HTML الضار', () => {
    const doc = buildBibliographyDoc([paper({ id: 'x', title: 'عنوان <script>alert(1)</script>', venue: 'مجلة التربية' })], 'apa');
    const html = buildPrintHtml(doc);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('<i>');
    expect(html).toContain('text-indent: -1.27cm');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('تحذيرات التوثيق الناقص', () => {
  it('لا اختلاق: الحقل المفقود يظهر كتحذير', () => {
    const c = formatCitation(paper({ venue: undefined }), 'apa');
    expect(c.warnings).toContain('اسم المجلة غير متوفر');
  });
});

describe('المصادر من جهة العميل', () => {
  it('OpenAlex: الدولة مأخوذة من بيانات الجهة، والفلتر على country_code لا على نص الاستعلام', async () => {
    let url = '';
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => {
      url = String(u);
      return new Response(JSON.stringify({ results: [{ id: 'https://openalex.org/W1', title: 'تعليم', publication_year: 2020, type: 'article', cited_by_count: 4,
        authorships: [{ author: { display_name: 'أحمد' }, institutions: [{ display_name: 'Cairo University', country_code: 'EG' }, { display_name: 'MIT', country_code: 'US' }] }],
        primary_location: { source: { display_name: 'Journal X' } }, biblio: { volume: '9', issue: '2', first_page: '10', last_page: '20' }, open_access: { is_oa: true } }] }), { status: 200 });
    }));
    const { papers: r } = await searchOpenAlex(filters({ query: 'التعليم', egyptOnly: true }));
    expect(decodeURIComponent(url)).toContain('country_code:EG');
    expect(decodeURIComponent(url)).not.toMatch(/Egypt|مصر/);
    expect(r[0]).toMatchObject({ venue: 'Journal X', volume: '9', issue: '2', pages: '10–20' });
    expect(r[0].countryCodes?.sort()).toEqual(['EG', 'US']);
  });

  it('Crossref وSemantic Scholar: لا تلويث للاستعلام بكلمة مصر/Egypt', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => { urls.push(decodeURIComponent(String(u))); return new Response(JSON.stringify({ message: { items: [] }, data: [], results: [] }), { status: 200 }); }));
    await searchCrossref(filters({ query: 'التعليم', egyptOnly: true })).catch(() => undefined);
    await searchSemanticScholar(filters({ query: 'التعليم', englishQuery: 'education', egyptOnly: true })).catch(() => undefined);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).not.toMatch(/Egypt|مصر/);
  });

  it('ERIC: لا إضافة Egypt للاستعلام (فحص ساكن للكود)', () => {
    expect(readFileSync('src/services/sources/eric.ts', 'utf-8')).not.toMatch(/egyptOnly\s*\?\s*'Egypt'/);
  });
});

describe('أمان الحزمة البرمجية', () => {
  it('لا يوجد أي مفتاح VITE_ سري في الشيفرة المصدرية', () => {
    const cfg = readFileSync('src/utils/config.ts', 'utf-8') + readFileSync('src/vite-env.d.ts', 'utf-8');
    expect(cfg).not.toMatch(/VITE_[A-Z_]*(KEY|SECRET|TOKEN)/);
  });
});
