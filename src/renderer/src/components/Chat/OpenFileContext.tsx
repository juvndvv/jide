import { createContext, useContext, type JSX, type ReactNode } from 'react';

type OpenFileFn = (path: string) => void;

const OpenFileContext = createContext<OpenFileFn | null>(null);

export function OpenFileProvider({
  value,
  children,
}: {
  value: OpenFileFn | null;
  children: ReactNode;
}): JSX.Element {
  return <OpenFileContext.Provider value={value}>{children}</OpenFileContext.Provider>;
}

export function useOpenFile(): OpenFileFn | null {
  return useContext(OpenFileContext);
}
