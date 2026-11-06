// أنواع بحث الويب والذكاء الاصطناعي (منفصلة عن أنواع البحث الأكاديمي ولا تغيّرها)
export type SearchMode = 'academic' | 'web';

export interface WebResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  displayLink: string;
}

export interface WebSearchPage {
  provider: string;
  results: WebResult[];
  nextStart: number | null;
}

export interface BackendStatus {
  search: string | null; // اسم مزوّد البحث المفعّل أو null
  ai: Record<AiProviderId, boolean>;
  auth?: { clientId: string } | null; // null/غائب = الحسابات غير مفعّلة
}

export type AiProviderId = 'gemini' | 'grok' | 'openai' | 'deepseek';

export interface AiDoc {
  title: string;
  text: string;
  url?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiAnswer {
  provider: AiProviderId;
  ok: boolean;
  text?: string;
  error?: string;
}
