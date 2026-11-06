import { createContext, useContext } from 'react';

// سياق لفتح نافذة فاحص العناوين من أي صفحة
interface CheckerCtx {
  openChecker: (initialTopic?: string) => void;
}

export const CheckerContext = createContext<CheckerCtx>({ openChecker: () => undefined });
export const useChecker = (): CheckerCtx => useContext(CheckerContext);
