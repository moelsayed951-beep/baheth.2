import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => (
  <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-20 text-center">
    <h1 className="text-5xl font-extrabold text-academic-green dark:text-academic-gold">404</h1>
    <p className="text-stone-600 dark:text-stone-400">الصفحة التي تبحث عنها غير موجودة.</p>
    <Link to="/" className="btn-primary">العودة للرئيسية</Link>
  </main>
);
