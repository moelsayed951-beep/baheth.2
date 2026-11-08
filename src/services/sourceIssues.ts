// تحويل أسباب تعذّر المصادر إلى رسائل مفهومة وهادئة، وتمييز «يحتاج إعداداً» عن «فشل حقيقي».
import type { AcademicSourceId, SourceIssue } from '@/types';
import { ProxyError } from '@/utils/proxy';
import { SourceSkipped } from './errors';

export interface Classified { status: 'skipped' | 'error'; message: string; issue: SourceIssue }

const KEYS_PAGE = { label: 'أضف مفتاحك', to: '/settings' };

export function classifyFailure(id: AcademicSourceId, reason: unknown): Classified {
  if (reason instanceof SourceSkipped && reason.kind) {
    return { status: 'skipped', message: reason.message, issue: { kind: reason.kind, action: reason.kind === 'needs_key' ? KEYS_PAGE : undefined } };
  }
  if (reason instanceof SourceSkipped) return { status: 'skipped', message: reason.message, issue: { kind: 'other' } };

  if (reason instanceof ProxyError) {
    const { code, status } = reason;
    if (id === 'core' && (code === 'not_configured' || code === 'upstream_auth')) {
      return { status: 'skipped', message: 'يتطلب مفتاح CORE: أضف مفتاحك من «مفاتيحي»، أو CORE_API_KEY في إعدادات Cloudflare (للمشرف)', issue: { kind: 'needs_key', action: KEYS_PAGE } };
    }
    if (id === 'semanticscholar' && (code === 'quota' || code === 'upstream_auth' || status === 429)) {
      return { status: 'skipped', message: 'حدّ الطلبات المجاني لـ Semantic Scholar مزدحم: أضف مفتاحك من «مفاتيحي» أو S2_API_KEY في Cloudflare', issue: { kind: 'needs_key', action: KEYS_PAGE } };
    }
    if (code === 'base_ip_not_registered') {
      return { status: 'skipped', message: 'يتطلب تسجيل IP لدى BASE (يُتجاهل بهدوء)', issue: { kind: 'needs_ip' } };
    }
    if (id === 'zenodo' && (code === 'upstream_auth' || status === 403 || status === 401)) {
      return { status: 'skipped', message: 'يتطلب تسجيل دخول (رمز وصول Zenodo عبر ZENODO_ACCESS_TOKEN)', issue: { kind: 'needs_login' } };
    }
    if (code === 'login_required') return { status: 'skipped', message: 'يتطلب تسجيل الدخول بحساب Google (أو مفتاح Tavily الخاص بك)', issue: { kind: 'needs_login', action: KEYS_PAGE } };
    if (code === 'daily_quota' || code === 'capacity') return { status: 'skipped', message: reason.message, issue: { kind: 'quota' } };
    if (code === 'quota' || code === 'rate_limited' || status === 429) return { status: 'skipped', message: 'ازدحام مؤقت لدى المصدر، جرّب بعد قليل', issue: { kind: 'quota' } };
    if (code === 'timeout' || code === 'network' || status === 504 || status === 0) return { status: 'error', message: 'تعذر الاتصال مؤقتاً', issue: { kind: 'network' } };
    return { status: 'error', message: reason.message, issue: { kind: 'other' } };
  }
  return { status: 'error', message: reason instanceof Error ? reason.message : 'تعذر الاتصال بالمصدر', issue: { kind: 'other' } };
}
