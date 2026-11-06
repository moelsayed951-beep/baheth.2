import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, KeyRound, Moon, Search, ShieldCheck, Sun } from 'lucide-react';
import { useChecker } from '@/context/CheckerContext';
import { useTheme } from '@/hooks/useTheme';
import { UserMenu } from '@/components/Auth/UserMenu';

export const Navbar: React.FC = () => {
  const { openChecker } = useChecker();
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-b border-stone-200 dark:border-stone-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-academic-green flex items-center justify-center text-academic-gold shadow">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xl font-bold font-tajawal text-academic-green dark:text-academic-gold">باحث</span>
            <span className="text-xs hidden sm:block text-stone-500 dark:text-stone-400">أبحاث • رسائل ماجستير ودكتوراه • كتب</span>
          </div>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-3 text-xs sm:text-sm font-medium">
          <Link to="/search" className="flex items-center gap-1 px-2 py-1.5 text-stone-600 dark:text-stone-300 hover:text-academic-green dark:hover:text-academic-gold">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">البحث الشامل</span>
          </Link>
          <Link to="/theses" className="hidden md:flex items-center gap-1 px-2 py-1.5 text-stone-600 dark:text-stone-300 hover:text-academic-green dark:hover:text-academic-gold">
            <span>الرسائل الجامعية</span>
          </Link>
          <Link to="/library" className="flex items-center gap-1 px-2 py-1.5 text-stone-600 dark:text-stone-300 hover:text-academic-green dark:hover:text-academic-gold">
            <span>مكتبتي</span>
          </Link>
          <Link to="/assistant" className="hidden sm:flex items-center gap-1 px-2 py-1.5 text-stone-600 dark:text-stone-300 hover:text-academic-green dark:hover:text-academic-gold">
            <span>مساعد البحث</span>
          </Link>
          <button
            onClick={() => openChecker()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-academic-gold/20 text-amber-900 dark:text-academic-gold font-bold hover:bg-academic-gold/30 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>فحص العناوين</span>
          </button>
          <UserMenu />
          <Link to="/settings" aria-label="مفاتيحي" title="مفاتيحي (لتفعيل المساعد الذكي)" className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800">
            <KeyRound className="w-4 h-4" />
          </Link>
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الليلي'}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </nav>
      </div>
    </header>
  );
};
