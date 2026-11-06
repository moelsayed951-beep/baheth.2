import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

// إدارة الوضع الليلي مع حفظ التفضيل (localStorage قد يكون غير متاح، لذا try/catch)
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('baheth-theme', theme);
    } catch {
      /* تجاهل */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
