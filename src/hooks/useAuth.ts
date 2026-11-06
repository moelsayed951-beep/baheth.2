import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callProxy } from '@/utils/proxy';
import { useBackendStatus } from './useBackendStatus';

export interface AuthUser { email: string; name: string; picture: string }
export interface Quota { web: { used: number; limit: number }; ai: { used: number; limit: number } }
interface MeResponse { user: AuthUser | null; quota?: Quota }

export function useAuth() {
  const { status, loaded } = useBackendStatus();
  const qc = useQueryClient();
  const enabled = Boolean(status?.auth);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => callProxy<MeResponse>('/api/auth/me', { signal }),
    enabled,
    staleTime: 60_000,
    retry: 0
  });

  const signIn = useCallback(async (credential: string) => {
    await callProxy('/api/auth/google', { method: 'POST', body: { credential } });
    await qc.invalidateQueries({ queryKey: ['me'] });
    await qc.invalidateQueries({ queryKey: ['favorites'] });
  }, [qc]);

  const signOut = useCallback(async () => {
    await callProxy('/api/auth/logout', { method: 'POST', body: {} });
    qc.setQueryData(['me'], { user: null });
    qc.removeQueries({ queryKey: ['favorites'] });
  }, [qc]);

  // حذف نهائي للحساب وكل بياناته (المفضلة والحصة) من الخادم
  const deleteAccount = useCallback(async () => {
    await callProxy('/api/auth/account', { method: 'DELETE' });
    qc.setQueryData(['me'], { user: null });
    qc.removeQueries({ queryKey: ['library'] });
  }, [qc]);

  return {
    enabled,
    clientId: status?.auth?.clientId ?? null,
    ready: loaded && (!enabled || !me.isLoading),
    user: me.data?.user ?? null,
    quota: me.data?.quota,
    signIn,
    signOut,
    deleteAccount,
    refreshQuota: () => qc.invalidateQueries({ queryKey: ['me'] })
  };
}
