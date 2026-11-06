import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface GsiApi {
  accounts: { id: {
    initialize: (c: { client_id: string; callback: (r: { credential?: string }) => void; auto_select?: boolean }) => void;
    renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  } };
}
declare global { interface Window { google?: GsiApi } }

let gsiPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gsiPromise = null; reject(new Error('gsi')); };
      document.head.appendChild(s);
    });
  }
  return gsiPromise;
}

// زر «تسجيل الدخول بحساب Google» الرسمي. يُرسل الرمز للخادم الذي يتحقق منه وينشئ الجلسة.
export const GoogleSignInButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { clientId, signIn } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => {
            if (!r.credential) return;
            setError('');
            signIn(r.credential).catch((e: unknown) => setError(e instanceof Error ? e.message : 'تعذر تسجيل الدخول'));
          }
        });
        window.google.accounts.id.renderButton(ref.current, { type: compact ? 'icon' : 'standard', theme: 'outline', size: 'medium', shape: 'pill', text: 'signin_with', locale: 'ar' });
      })
      .catch(() => setError('تعذر تحميل خدمة Google (تحقق من الاتصال أو مانع الإعلانات)'));
    return () => { cancelled = true; };
  }, [clientId, compact, signIn]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div ref={ref} />
      {error && <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 max-w-[220px] text-center">{error}</p>}
    </div>
  );
};
