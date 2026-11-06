import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Navbar } from '@/components/Layout/Navbar';
import { Footer } from '@/components/Layout/Footer';
import { ThesesCheckerModal } from '@/components/Detail/ThesesCheckerModal';
import { AiChatWidget } from '@/components/AI/AiChatWidget';
import { AiChatContext, type ChatOpenOptions, type ChatRequest } from '@/context/AiChatContext';
import { CheckerContext } from '@/context/CheckerContext';
import { HomePage } from '@/pages/HomePage';
import { SearchRoute } from '@/pages/SearchRoute';
import { ThesesPage } from '@/pages/ThesesPage';
import { AssistantPage } from '@/pages/AssistantPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AboutPage } from '@/pages/AboutPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const App: React.FC = () => {
  const [checker, setChecker] = useState<{ open: boolean; topic: string }>({ open: false, topic: '' });
  const openChecker = useCallback((topic = '') => setChecker({ open: true, topic }), []);
  const closeChecker = useCallback(() => setChecker((c) => ({ ...c, open: false })), []);
  const ctx = useMemo(() => ({ openChecker }), [openChecker]);

  // الشات العائم: أي مكوّن يستطيع فتحه (مع مرجع ونص جاهز) عبر useAiChat()
  const [chatRequest, setChatRequest] = useState<ChatRequest | null>(null);
  const chatSeq = useRef(0);
  const openChat = useCallback((opts: ChatOpenOptions = {}) => setChatRequest({ ...opts, id: ++chatSeq.current }), []);
  const aiCtx = useMemo(() => ({ openChat }), [openChat]);

  return (
    <CheckerContext.Provider value={ctx}>
      <AiChatContext.Provider value={aiCtx}>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchRoute />} />
            <Route path="/theses" element={<ThesesPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/favorites" element={<LibraryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
        <Footer />
      </div>
      <ThesesCheckerModal isOpen={checker.open} onClose={closeChecker} initialTopic={checker.topic} />
      <AiChatWidget request={chatRequest} />
      </AiChatContext.Provider>
    </CheckerContext.Provider>
  );
};

export default App;
