import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';

export interface StackEntry {
  id: string;
  z: number;
  onEsc: () => void;
}

export interface OverlayStack {
  push: (entry: StackEntry) => void;
  remove: (id: string) => void;
  topId: () => string | null;
  size: () => number;
  getTopOnEsc: () => (() => void) | null;
}

interface StackStore {
  api: OverlayStack;
  subscribe: (listener: () => void) => () => void;
  getSnapshotEntries: () => readonly StackEntry[];
}

const OverlayStackStoreContext = createContext<StackStore | null>(null);

function sortEntries(entries: StackEntry[]): StackEntry[] {
  // Stable sort by z ascending; ties preserve insertion order. Top = last element.
  return [...entries].sort((a, b) => a.z - b.z);
}

export function OverlayStackProvider({ children }: { children: ReactNode }): JSX.Element {
  const entriesRef = useRef<StackEntry[]>([]);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const emit = useCallback((): void => {
    for (const l of listenersRef.current) l();
  }, []);

  const subscribe = useCallback((listener: () => void): (() => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshotEntries = useCallback((): readonly StackEntry[] => {
    return entriesRef.current;
  }, []);

  const api = useMemo<OverlayStack>(() => {
    return {
      push: (entry: StackEntry) => {
        const list = entriesRef.current;
        if (list.some((e) => e.id === entry.id)) {
          if (import.meta.env?.DEV) {
            console.warn(`[overlay] duplicate id "${entry.id}" ignored`);
          }
          return;
        }
        entriesRef.current = sortEntries([...list, entry]);
        emit();
      },
      remove: (id: string) => {
        const list = entriesRef.current;
        const next = list.filter((e) => e.id !== id);
        if (next.length === list.length) return;
        entriesRef.current = next;
        emit();
      },
      topId: () => {
        const list = entriesRef.current;
        const top = list[list.length - 1];
        return top ? top.id : null;
      },
      size: () => entriesRef.current.length,
      getTopOnEsc: () => {
        const list = entriesRef.current;
        const top = list[list.length - 1];
        return top ? top.onEsc : null;
      },
    };
  }, [emit]);

  const store = useMemo<StackStore>(
    () => ({ api, subscribe, getSnapshotEntries }),
    [api, subscribe, getSnapshotEntries],
  );

  return (
    <OverlayStackStoreContext.Provider value={store}>{children}</OverlayStackStoreContext.Provider>
  );
}

function useStore(): StackStore {
  const store = useContext(OverlayStackStoreContext);
  if (!store) throw new Error('OverlayStackProvider is missing in the React tree');
  return store;
}

export function useOverlayStack(): OverlayStack {
  return useStore().api;
}

export function useIsTopOverlay(id: string): boolean {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => {
      const entries = store.getSnapshotEntries();
      const top = entries[entries.length - 1];
      return top ? top.id === id : false;
    },
    () => false,
  );
}

export function useModalOpen(): boolean {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshotEntries().length > 0,
    () => false,
  );
}
