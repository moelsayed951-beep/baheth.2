import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => (
  <footer className="border-t border-stone-200 dark:border-stone-800 py-6 px-4 text-center text-xs text-stone-500 dark:text-stone-400">
    <p>تُجلب النتائج من OpenAlex وERIC وSemantic Scholar وCORE وOpenAIRE وCrossref وPubMed وDOAJ وarXiv وBASE ومكتبات عربية عبر بحث الويب. باحث أداة استرشادية ولا تغني عن إفادة الجامعة الرسمية بعدم تكرار الموضوع.</p>
    <p className="mt-1">نتائج «بحث الويب» تأتي من محرك بحث عام، وإجابات المساعد الذكي من نماذج ذكاء اصطناعي قد تخطئ؛ راجع المصدر الأصلي دائماً.</p>
    <p className="mt-2"><Link to="/about" className="underline hover:text-academic-green dark:hover:text-academic-gold">عن المنصة وسياسة الخصوصية</Link></p>
  </footer>
);
