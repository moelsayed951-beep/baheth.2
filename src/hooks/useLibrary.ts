// مكتبة المراجع: سحابية (بحساب Google) أو محلية على الجهاز — واجهة واحدة للمكوّنات.
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paper } from '@/types';
import { callProxy } from '@/utils/proxy';
import { LOCAL_MAX, localAdd, localClear, localRemove, localSetNote, localSnapshot, useLocalLibrary, type LibraryItem } from '@/utils/localLibrary';
import { useAuth } from './useAuth';

export type { LibraryItem };

export function useLibrary() {
  const { enabled, user } = useAuth();
  const qc = useQueryClient();
  const cloud = enabled && Boolean(user);
  const local = useLocalLibrary();

  const list = useQuery({
    queryKey: ['library'],
    queryFn: ({ signal }) => callProxy<{ items: LibraryItem[] }>('/api/favorites', { signal }),
    enabled: cloud,
    staleTime: 60_000,
    retry: 0
  });

  const items = useMemo(() => (cloud ? list.data?.items ?? [] : local), [cloud, list.data, local]);
  const ids = useMemo(() => new Set(items.map((i) => i.paper.id)), [items]);

  const cloudWrite = useMutation({
    mutationFn: async (op: { kind: 'add'; paper: Paper } | { kind: 'remove'; id: string } | { kind: 'note'; id: string; note: string }) => {
      if (op.kind === 'add') await callProxy('/api/favorites', { method: 'POST', body: { paper: op.paper } });
      else if (op.kind === 'remove') await callProxy(`/api/favorites?id=${encodeURIComponent(op.id)}`, { method: 'DELETE' });
      else await callProxy('/api/favorites', { method: 'PUT', body: { id: op.id, note: op.note } });
    },
    onMutate: async (op) => {
      await qc.cancelQueries({ queryKey: ['library'] });
      const prev = qc.getQueryData<{ items: LibraryItem[] }>(['library']);
      const cur = prev?.items ?? [];
      const next = op.kind === 'add' ? [{ paper: op.paper, note: '', addedAt: Date.now() }, ...cur.filter((i) => i.paper.id !== op.paper.id)]
        : op.kind === 'remove' ? cur.filter((i) => i.paper.id !== op.id)
        : cur.map((i) => (i.paper.id === op.id ? { ...i, note: op.note } : i));
      qc.setQueryData(['library'], { items: next });
      return { prev };
    },
    onError: (_e, _o, ctx) => { if (ctx?.prev) qc.setQueryData(['library'], ctx.prev); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['library'] }); }
  });

  const add = useCallback((paper: Paper): boolean => {
    if (cloud) { cloudWrite.mutate({ kind: 'add', paper }); return true; }
    return localAdd(paper);
  }, [cloud, cloudWrite]);
  const remove = useCallback((id: string) => { if (cloud) cloudWrite.mutate({ kind: 'remove', id }); else localRemove(id); }, [cloud, cloudWrite]);
  const setNote = useCallback((id: string, note: string) => { if (cloud) cloudWrite.mutate({ kind: 'note', id, note }); else localSetNote(id, note); }, [cloud, cloudWrite]);

  // رفع مكتبة الجهاز إلى الحساب على دفعات (50) ثم تفريغ النسخة المحلية
  const uploadLocalToCloud = useCallback(async (): Promise<number> => {
    const snap = localSnapshot();
    let added = 0;
    for (let i = 0; i < snap.length; i += 50) {
      const chunk = snap.slice(i, i + 50).map((x) => ({ paper: x.paper, note: x.note }));
      const r = await callProxy<{ added: number }>('/api/favorites', { method: 'POST', body: { papers: chunk } });
      added += r.added;
    }
    localClear();
    await qc.invalidateQueries({ queryKey: ['library'] });
    return added;
  }, [qc]);

  return {
    mode: cloud ? ('cloud' as const) : ('local' as const),
    items,
    loading: cloud && list.isLoading,
    has: (id: string) => ids.has(id),
    add,
    remove,
    setNote,
    toggle: (paper: Paper) => (ids.has(paper.id) ? remove(paper.id) : add(paper)),
    uploadLocalToCloud,
    localCount: cloud ? localSnapshot().length : 0,
    capacity: cloud ? 500 : LOCAL_MAX,
    error: cloudWrite.error instanceof Error ? cloudWrite.error.message : ''
  };
}
