import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBackendStatus } from '@/services/googleSearchService';
import type { AiProviderId, BackendStatus } from '@/types/web';
import { useUserKeys } from '@/utils/userKeys';

const AI_ORDER: AiProviderId[] = ['gemini', 'grok', 'openai', 'deepseek'];

// حالة الخدمات المفعّلة على الخادم (تُجلب مرة وتُخزَّن 5 دقائق)
export function useBackendStatus(enabled = true): {
  status: BackendStatus | undefined;
  loaded: boolean;
  aiProviders: AiProviderId[];
  searchProvider: string | null;
} {
  const q = useQuery({
    queryKey: ['backend-status'],
    queryFn: ({ signal }) => getBackendStatus(signal),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 0
  });
  const status = q.data;
  const userKeys = useUserKeys();
  // مصفوفة ثابتة المرجع ما لم تتغير الحالة (لتفادي إعادة تشغيل الـ effects)
  const aiProviders = useMemo(() => AI_ORDER.filter((p) => Boolean(userKeys[p]) || Boolean(status?.ai[p])), [status, userKeys]);
  return {
    status,
    loaded: q.isSuccess || q.isError,
    aiProviders,
    searchProvider: status?.search ?? (userKeys.tavily ? 'tavily' : null)
  };
}
