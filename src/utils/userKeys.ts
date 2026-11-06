// مفاتيح API الخاصة بالمستخدم (BYOK).
// الافتراضي الأكثر أماناً: تُحفظ في sessionStorage (تُمحى بإغلاق التبويب). وللراحة يمكنه اختيار «تذكّر على هذا الجهاز»
// فتُحفظ في localStorage. لا تُرفع لأي قاعدة بيانات؛ تُرسل مع كل طلب عبر HTTPS لوسيط المنصة الذي لا يخزنها ولا يسجلها.
import { useSyncExternalStore } from 'react';

export type KeyId = 'gemini' | 'grok' | 'openai' | 'deepseek' | 'tavily';
export type UserKeys = Partial<Record<KeyId, string>>;

const STORE = 'baheth-user-keys';
const REMEMBER = 'baheth-remember-keys';
const KEY_RE = /^[A-Za-z0-9_\-.:]{8,300}$/;
const listeners = new Set<() => void>();
let cache: UserKeys | null = null;

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
const remember = (): boolean => safe(() => localStorage.getItem(REMEMBER) === '1', false);
const area = (): Storage => (remember() ? localStorage : sessionStorage);

function load(): UserKeys {
  if (cache) return cache;
  cache = safe(() => {
    const raw = area().getItem(STORE);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? (parsed as UserKeys) : {};
  }, {} as UserKeys);
  return cache;
}

function persist(next: UserKeys): void {
  cache = next;
  safe(() => {
    // نمسح النسخة في المخزن الآخر لئلا يبقى مفتاح قديم في مكان غير مقصود
    (remember() ? sessionStorage : localStorage).removeItem(STORE);
    area().setItem(STORE, JSON.stringify(next));
  }, undefined);
  listeners.forEach((l) => l());
}

export const isValidKey = (v: string): boolean => KEY_RE.test(v.trim());
export const getKey = (id: KeyId): string | undefined => load()[id] || undefined;
export const isRemembered = (): boolean => remember();

export function setKey(id: KeyId, value: string): void {
  const next = { ...load() };
  const v = value.trim();
  if (v) next[id] = v; else delete next[id];
  persist(next);
}

export function setRemember(on: boolean): void {
  const current = load();
  safe(() => { if (on) localStorage.setItem(REMEMBER, '1'); else localStorage.removeItem(REMEMBER); }, undefined);
  persist(current); // ينقل المفاتيح إلى المخزن الجديد ويمسح القديم
}

export const clearAllKeys = (): void => persist({});

export function useUserKeys(): UserKeys {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, load, () => ({}));
}
