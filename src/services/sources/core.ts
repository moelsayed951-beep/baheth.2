// CORE عبر وسيط Cloudflare: يقرأ مفتاح المستخدم (إن وُجد) ويرسله في الترويسة X-User-Core-Key،
// وإلا يستخدم الوسيط مفتاح المنصة CORE_API_KEY كخطة بديلة. المنطق المشترك في proxied.ts
import type { FilterOptions, Paper } from '@/types';
import { searchProxied } from './proxied';

export const searchCore = (filters: FilterOptions, signal?: AbortSignal): Promise<Paper[]> => searchProxied('core', filters, signal);
