import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';

export interface ShortcutContext {
  modalOpen: boolean;
  inputFocused: boolean;
  chatFocused: boolean;
  sessionActive: boolean;
  sessionCapReached: boolean;
}

export type ShortcutId =
  | 'palette.open'
  | 'help.open'
  | 'overlay.close'
  | 'worktree.new'
  | 'tweaks.toggle'
  | 'terminal.toggle'
  | 'viewer.toggle'
  | 'session.new'
  | 'session.kill';

export interface ShortcutDispatcher {
  register: (id: ShortcutId, handler: () => void) => () => void;
  dispatch: (id: ShortcutId) => void;
}

const DEFAULT_CONTEXT: ShortcutContext = {
  modalOpen: false,
  inputFocused: false,
  chatFocused: false,
  sessionActive: false,
  sessionCapReached: false,
};

export const ShortcutContextStateContext = createContext<ShortcutContext>(DEFAULT_CONTEXT);

const noopDispatcher: ShortcutDispatcher = {
  register: () => () => {},
  dispatch: () => {},
};

export const ShortcutDispatcherContext = createContext<ShortcutDispatcher>(noopDispatcher);

interface SettersBag {
  setModalOpen: (v: boolean) => void;
  setChatFocused: (v: boolean) => void;
  setSessionActive: (v: boolean) => void;
  setSessionCapReached: (v: boolean) => void;
}

const ShortcutSettersContext = createContext<SettersBag | null>(null);

function isFocusableEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function ShortcutContextProvider({ children }: { children: ReactNode }): JSX.Element {
  const [modalOpen, setModalOpenState] = useState(false);
  const [chatFocused, setChatFocusedState] = useState(false);
  const [sessionActive, setSessionActiveState] = useState(false);
  const [sessionCapReached, setSessionCapReachedState] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent): void => {
      if (isFocusableEditable(e.target)) setInputFocused(true);
    };
    const onFocusOut = (e: FocusEvent): void => {
      if (isFocusableEditable(e.target)) setInputFocused(false);
    };
    document.body.addEventListener('focusin', onFocusIn);
    document.body.addEventListener('focusout', onFocusOut);
    return () => {
      document.body.removeEventListener('focusin', onFocusIn);
      document.body.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const ctxValue = useMemo<ShortcutContext>(
    () => ({ modalOpen, inputFocused, chatFocused, sessionActive, sessionCapReached }),
    [modalOpen, inputFocused, chatFocused, sessionActive, sessionCapReached],
  );

  const handlersRef = useRef<Map<ShortcutId, Array<() => void>>>(new Map());

  const dispatcher = useMemo<ShortcutDispatcher>(() => {
    return {
      register: (id, handler) => {
        const map = handlersRef.current;
        const stack = map.get(id) ?? [];
        stack.push(handler);
        map.set(id, stack);
        return () => {
          const current = map.get(id);
          if (!current) return;
          const idx = current.lastIndexOf(handler);
          if (idx >= 0) current.splice(idx, 1);
          if (current.length === 0) map.delete(id);
        };
      },
      dispatch: (id) => {
        const stack = handlersRef.current.get(id);
        if (!stack || stack.length === 0) return;
        const top = stack[stack.length - 1];
        top?.();
      },
    };
  }, []);

  const setModalOpen = useCallback((v: boolean) => setModalOpenState(v), []);
  const setChatFocused = useCallback((v: boolean) => setChatFocusedState(v), []);
  const setSessionActive = useCallback((v: boolean) => setSessionActiveState(v), []);
  const setSessionCapReached = useCallback((v: boolean) => setSessionCapReachedState(v), []);

  const setters = useMemo<SettersBag>(
    () => ({ setModalOpen, setChatFocused, setSessionActive, setSessionCapReached }),
    [setModalOpen, setChatFocused, setSessionActive, setSessionCapReached],
  );

  return (
    <ShortcutContextStateContext.Provider value={ctxValue}>
      <ShortcutDispatcherContext.Provider value={dispatcher}>
        <ShortcutSettersContext.Provider value={setters}>
          {children}
        </ShortcutSettersContext.Provider>
      </ShortcutDispatcherContext.Provider>
    </ShortcutContextStateContext.Provider>
  );
}

export function useShortcutContext(): ShortcutContext {
  return useContext(ShortcutContextStateContext);
}

export function useShortcutDispatcher(): ShortcutDispatcher {
  return useContext(ShortcutDispatcherContext);
}

function useSetters(): SettersBag {
  const setters = useContext(ShortcutSettersContext);
  if (!setters) {
    throw new Error('ShortcutContextProvider is missing in the React tree');
  }
  return setters;
}

export function useSetChatFocused(): (v: boolean) => void {
  return useSetters().setChatFocused;
}

export function useSetSessionActive(): (v: boolean) => void {
  return useSetters().setSessionActive;
}

export function useSetSessionCapReached(): (v: boolean) => void {
  return useSetters().setSessionCapReached;
}

export function useSetModalOpen(): (v: boolean) => void {
  return useSetters().setModalOpen;
}
