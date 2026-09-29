/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import type { FC, FocusEvent, ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

export const FieldDocProvider: FC<{
  enabled?: boolean;
  children: ReactNode;
}> = ({ enabled = false, children }) => {
  const [entries, setEntries] = useState<Map<string, FieldDocEntry>>(
    () => new Map()
  );
  const [activeName, setActiveName] = useState<string | undefined>(undefined);

  const register = useCallback((name: string, entry: FieldDocEntry) => {
    setEntries((prev) => new Map(prev).set(name, entry));
  }, []);

  const unregister = useCallback((name: string) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.delete(name);

      return next;
    });
  }, []);

  const setActive = useCallback((name?: string) => setActiveName(name), []);

  const value = useMemo<FieldDocRegistry>(
    () => ({
      register,
      unregister,
      setActive,
      activeName,
      entries,
      enabled,
    }),
    [register, unregister, setActive, activeName, enabled, entries]
  );

  return (
    <FieldDocContext.Provider value={value}>
      {children}
    </FieldDocContext.Provider>
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
      entries: new Map<string, FieldDocEntry>(),
      enabled: false,
    }
  );
};

export const useActiveFieldDoc = (): {
  name?: string;
  entry?: FieldDocEntry;
} => {
  const { activeName, entries } = useFieldDocRegistry();

  return {
    name: activeName,
    entry: activeName ? entries.get(activeName) : undefined,
  };
};

/**
 * Register a field's documentation and mark it active on focus. Spread the
 * returned props onto the field's wrapping element (`<Box {...fieldDoc}>`).
 * The `data-field-doc` marker lets the popover re-find the current anchor by
 * field name on every render, so positioning survives re-renders/remounts
 * (e.g. when parameter fields appear below the focused field). Use this for
 * custom fields not rendered through `getField` (card groups, tag pickers).
 */
export const useFieldDoc = ({
  name,
  label,
  doc,
}: {
  name: string;
  label: ReactNode;
  doc?: string;
}): {
  onFocusCapture?: (event: FocusEvent<HTMLElement>) => void;
  onPointerDownCapture?: () => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  'data-field-doc'?: string;
} => {
  const { enabled, register, unregister, setActive } = useFieldDocRegistry();
  const hasDoc = enabled && typeof doc === 'string' && doc.length > 0;

  useEffect(() => {
    if (!hasDoc) {
      return undefined;
    }
    register(name, { label, doc: doc as string });

    return () => unregister(name);
  }, [hasDoc, name, label, doc, register, unregister]);

  const activate = hasDoc ? () => setActive(name) : undefined;

  // Clear the active hint when focus leaves the documented fields entirely
  // (tab away to an undocumented field, or click outside). Focus moving to
  // another documented field is left to that field's onFocusCapture, so the
  // hint follows focus instead of flickering closed.
  const deactivate = hasDoc
    ? (event: FocusEvent<HTMLElement>) => {
        const nextFocused = event.relatedTarget as HTMLElement | null;
        if (!nextFocused?.closest('[data-field-doc]')) {
          setActive(undefined);
        }
      }
    : undefined;

  // Activate on focus (keyboard) and on pointer-down (click), so fields whose
  // control does not take focus on click (e.g. a card group) still show docs.
  return {
    onFocusCapture: activate,
    onPointerDownCapture: activate,
    onBlur: deactivate,
    'data-field-doc': hasDoc ? name : undefined,
  };
};
