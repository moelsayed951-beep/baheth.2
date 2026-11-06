// مكتبة محلية في متصفح المستخدم (بلا حساب). تبقى على الجهاز فقط، ويمكن رفعها لحسابه عند تسجيل الدخول.
import { useSyncExternalStore } from 'react';
import type { Paper } from '@/types';

export interface LibraryItem { paper: Paper; note: string; addedAt: number }

const KEY = 'baheth-library';
export const LOCAL_MAX = 300;
const listeners = new Set<() => void>();
let cache: LibraryItem[] | null = null;

function load(): LibraryItem[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? (parsed as LibraryItem[]).filter((i) => i?.paper?.id && i.paper.title) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist(next: LibraryItem[]): void {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* التخزين ممتلئ/غير متاح */ }
  listeners.forEach((l) => l());
}

const trimPaper = (p: Paper): Paper => ({ ...p, abstract: p.abstract.slice(0, 1500) });

export function localAdd(paper: Paper, note = ''): boolean {
  const cur = load();
  if (cur.some((i) => i.paper.id === paper.id)) return true;
  if (cur.length >= LOCAL_MAX) return false;
  persist([{ paper: trimPaper(paper), note, addedAt: Date.now() }, ...cur]);
  return true;
}
export const localRemove = (id: string): void => persist(load().filter((i) => i.paper.id !== id));
export const localSetNote = (id: string, note: string): void => persist(load().map((i) => (i.paper.id === id ? { ...i, note: note.slice(0, 2000) } : i)));
export const localClear = (): void => persist([]);
export const localSnapshot = (): LibraryItem[] => load();

export function useLocalLibrary(): LibraryItem[] {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, load, () => []);
}
