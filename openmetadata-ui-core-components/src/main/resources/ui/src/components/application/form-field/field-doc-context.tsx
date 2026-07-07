import type { FC, ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export interface FieldDocEntry {
  label: ReactNode;
  doc: string;
}

interface FieldDocRegistry {
  register: (name: string, entry: FieldDocEntry) => void;
  unregister: (name: string) => void;
  setActive: (name?: string) => void;
  activeName?: string;
  entries: Map<string, FieldDocEntry>;
  enabled: boolean;
}

const FieldDocContext = createContext<FieldDocRegistry | undefined>(undefined);

export const FieldDocProvider: FC<{ enabled?: boolean; children: ReactNode }> = ({
  enabled = false,
  children,
}) => {
  const entriesRef = useRef<Map<string, FieldDocEntry>>(new Map());
  const [, forceRender] = useState(0);
  const [activeName, setActiveName] = useState<string | undefined>(undefined);

  const register = useCallback((name: string, entry: FieldDocEntry) => {
    entriesRef.current.set(name, entry);
    forceRender((n) => n + 1);
  }, []);

  const unregister = useCallback((name: string) => {
    entriesRef.current.delete(name);
    forceRender((n) => n + 1);
  }, []);

  const setActive = useCallback((name?: string) => setActiveName(name), []);

  const value = useMemo<FieldDocRegistry>(
    () => ({
      register,
      unregister,
      setActive,
      activeName,
      entries: entriesRef.current,
      enabled,
    }),
    [register, unregister, setActive, activeName, enabled]
  );

  return <FieldDocContext.Provider value={value}>{children}</FieldDocContext.Provider>;
};

export const useFieldDocRegistry = (): FieldDocRegistry => {
  const ctx = useContext(FieldDocContext);

  return (
    ctx ?? {
      register: () => undefined,
      unregister: () => undefined,
      setActive: () => undefined,
      activeName: undefined,
      entries: new Map<string, FieldDocEntry>(),
      enabled: false,
    }
  );
};

export const useActiveFieldDoc = (): { name?: string; entry?: FieldDocEntry } => {
  const { activeName, entries } = useFieldDocRegistry();

  return {
    name: activeName,
    entry: activeName ? entries.get(activeName) : undefined,
  };
};
