import type { FC, FocusEvent, ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface FieldDocEntry {
  label: ReactNode;
  doc: string;
}

interface FieldDocRegistry {
  register: (name: string, entry: FieldDocEntry) => void;
  unregister: (name: string) => void;
  setActive: (name?: string, anchor?: HTMLElement | null) => void;
  activeName?: string;
  activeAnchor?: HTMLElement | null;
  entries: Map<string, FieldDocEntry>;
  enabled: boolean;
}

const FieldDocContext = createContext<FieldDocRegistry | undefined>(undefined);

export const FieldDocProvider: FC<{ enabled?: boolean; children: ReactNode }> = ({
  enabled = false,
  children,
}) => {
  const entriesRef = useRef<Map<string, FieldDocEntry>>(new Map());
  const [version, setVersion] = useState(0);
  const [active, setActiveState] = useState<{
    name: string;
    anchor: HTMLElement | null;
  } | null>(null);

  const register = useCallback((name: string, entry: FieldDocEntry) => {
    entriesRef.current.set(name, entry);
    setVersion((n) => n + 1);
  }, []);

  const unregister = useCallback((name: string) => {
    entriesRef.current.delete(name);
    setVersion((n) => n + 1);
  }, []);

  const setActive = useCallback(
    (name?: string, anchor?: HTMLElement | null) =>
      setActiveState(name ? { name, anchor: anchor ?? null } : null),
    []
  );

  const value = useMemo<FieldDocRegistry>(
    () => ({
      register,
      unregister,
      setActive,
      activeName: active?.name,
      activeAnchor: active?.anchor ?? null,
      entries: entriesRef.current,
      enabled,
    }),
    [register, unregister, setActive, active, enabled, version]
  );

  return (
    <FieldDocContext.Provider value={value}>{children}</FieldDocContext.Provider>
  );
};

export const useFieldDocRegistry = (): FieldDocRegistry => {
  const ctx = useContext(FieldDocContext);

  return (
    ctx ?? {
      register: () => undefined,
      unregister: () => undefined,
      setActive: () => undefined,
      activeName: undefined,
      activeAnchor: null,
      entries: new Map<string, FieldDocEntry>(),
      enabled: false,
    }
  );
};

export const useActiveFieldDoc = (): {
  name?: string;
  entry?: FieldDocEntry;
  anchor?: HTMLElement | null;
} => {
  const { activeName, activeAnchor, entries } = useFieldDocRegistry();

  return {
    name: activeName,
    entry: activeName ? entries.get(activeName) : undefined,
    anchor: activeAnchor,
  };
};

/**
 * Register a field's documentation and mark it active on focus. Use this for
 * custom fields that are not rendered through `getField` (e.g. a card group,
 * a tag picker). Spread the returned `onFocusCapture` onto the field's
 * wrapping element so focusing any control inside it shows the field's doc.
 */
export const useFieldDoc = ({
  name,
  label,
  doc,
}: {
  name: string;
  label: ReactNode;
  doc?: string;
}): { onFocusCapture?: (event: FocusEvent<HTMLElement>) => void } => {
  const { enabled, register, unregister, setActive } = useFieldDocRegistry();
  const hasDoc = enabled && typeof doc === 'string' && doc.length > 0;

  useEffect(() => {
    if (!hasDoc) {
      return undefined;
    }
    register(name, { label, doc: doc as string });

    return () => unregister(name);
  }, [hasDoc, name, label, doc, register, unregister]);

  return {
    onFocusCapture: hasDoc
      ? (event: FocusEvent<HTMLElement>) => setActive(name, event.currentTarget)
      : undefined,
  };
};
