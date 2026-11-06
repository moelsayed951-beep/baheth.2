import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAiChat } from '@/context/AiChatContext';
import { SUMMARIZE_PROMPT } from '@/services/aiService';
import { cn } from '@/utils/cn';

const TITLE_ONLY_PROMPT = 'لا يتوفر سوى العنوان أو مقتطف قصير جداً. ماذا يمكن أن يتناوله هذا المرجع بحسب عنوانه؟ وكيف أتحقق من صلته ببحثي قبل الاعتماد عليه؟';

interface Props {
  title: string;
  text: string; // الملخص أو المقتطف المتاح (قد يكون فارغاً)
  url?: string;
  className?: string;
}

// زر «اسأل الذكاء الاصطناعي»: يفتح الشات العائم ومعه المرجع ويرسل طلب التلخيص مباشرة
export const AskAiButton: React.FC<Props> = ({ title, text, url, className }) => {
  const { openChat } = useAiChat();
  const hasText = text.trim().length >= 80;
  return (
    <button
      type="button"
      onClick={() => openChat({ doc: { title, text: text.trim(), url }, prompt: hasText ? SUMMARIZE_PROMPT : TITLE_ONLY_PROMPT, autoSend: true })}
      className={cn('btn-ghost !border-academic-green/40 dark:!border-academic-gold/40 text-academic-green dark:text-academic-gold font-bold', className)}
    >
      <Sparkles className="w-3 h-3" />
      <span>اسأل الذكاء الاصطناعي</span>
    </button>
  );
};
