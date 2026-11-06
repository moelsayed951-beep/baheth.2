import { createContext, useContext } from 'react';
import type { AiDoc } from '@/types/web';

// سياق لفتح الشات العائم من أي مكان (مثلاً زر «اسأل الذكاء الاصطناعي» في بطاقة النتيجة)
export interface ChatOpenOptions {
  doc?: AiDoc; // مرجع يُرفق بالمحادثة (عنوان + ملخص/مقتطف)
  prompt?: string; // نص جاهز
  autoSend?: boolean; // إرسال النص فور الفتح
}

export interface ChatRequest extends ChatOpenOptions {
  id: number; // يتغير مع كل طلب فتح ليُنفَّذ حتى لو تكرر نفس المرجع
}

interface AiChatCtx {
  openChat: (opts?: ChatOpenOptions) => void;
}

export const AiChatContext = createContext<AiChatCtx>({ openChat: () => undefined });
export const useAiChat = (): AiChatCtx => useContext(AiChatContext);
