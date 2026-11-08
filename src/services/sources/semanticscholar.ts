// Semantic Scholar عبر وسيط Cloudflare: يقرأ مفتاح المستخدم (إن وُجد) ويرسله في الترويسة X-User-S2-Key،
// وإلا يستخدم الوسيط مفتاح المنصة S2_API_KEY كخطة بديلة. المنطق المشترك في proxied.ts
import type { FilterOptions, Paper } from '@/types';
import { searchProxied } from './proxied';

export const searchSemanticScholar = (filters: FilterOptions, signal?: AbortSignal): Promise<Paper[]> => searchProxied('semanticscholar', filters, signal);
