import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Library, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GoogleSignInButton } from './GoogleSignInButton';

// يظهر فقط إذا فُعّلت الحسابات على الخادم
export const UserMenu: React.FC = () => {
  const { enabled, user, ready, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!enabled || !ready) return null;
  if (!user) return <GoogleSignInButton compact />;

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="قائمة الحساب" className="w-9 h-9 rounded-full overflow-hidden border border-stone-300 dark:border-stone-700 bg-academic-green text-white font-bold flex items-center justify-center">
        {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : user.name.slice(0, 1)}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-2 w-56 card p-2 z-50 text-sm">
          <p className="px-2 py-1.5 text-xs text-stone-500 dark:text-stone-400 truncate" dir="ltr">{user.email}</p>
          <Link role="menuitem" to="/library" onClick={() => setOpen(false)} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"><Library className="w-4 h-4" />مكتبتي</Link>
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">حصتي ومفاتيحي</Link>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); void signOut(); }} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-red-700 dark:text-red-400"><LogOut className="w-4 h-4" />تسجيل الخروج</button>
        </div>
      )}
    </div>
  );
};
