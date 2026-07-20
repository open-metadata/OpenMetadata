/*
 *  Copyright 2026 Collate.
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

import { isUndefined } from 'lodash';
import { create } from 'zustand';
import {
  APP_MODE_SESSION_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';

/**
 * Payload persisted in `sessionStorage[APP_MODE_SESSION_KEY]`.
 * `personaAppMode` is the value the resolver saw from the persona doc
 * when this tuple was last written. `useResolvedAppMode` compares its
 * current view of the persona's `appMode` against this snapshot to
 * decide whether the persona has something new to say (invalidate the
 * session) or not (respect the tab's chosen mode).
 */
export interface AppModeSession {
  personaAppMode: string | null;
  mode: string;
}

const hasWindow = (): boolean => !isUndefined(globalThis.window);

// sessionStorage access can throw (Safari Private Mode blocks it entirely;
// quota-exceeded on writes; storage disabled by browser policy). Treat any
// failure as "no persistence available" and degrade to the in-memory store
// — the app still works, refreshes just don't remember the tab's mode.
const readSession = (): AppModeSession | null => {
  if (!hasWindow()) {
    return null;
  }
  let raw: string | null = null;
  try {
    raw = globalThis.window.sessionStorage.getItem(APP_MODE_SESSION_KEY);
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'mode' in parsed &&
      typeof (parsed as AppModeSession).mode === 'string'
    ) {
      const tuple = parsed as AppModeSession;
      const personaAppMode =
        typeof tuple.personaAppMode === 'string' ? tuple.personaAppMode : null;

      return { personaAppMode, mode: tuple.mode };
    }
  } catch {
    // fall through — malformed payloads are treated as absent
  }

  return null;
};

const writeSession = (tuple: AppModeSession): void => {
  if (!hasWindow()) {
    return;
  }
  try {
    globalThis.window.sessionStorage.setItem(
      APP_MODE_SESSION_KEY,
      JSON.stringify(tuple)
    );
  } catch {
    // Storage disabled / quota exceeded — the in-memory store still holds
    // the mode, so the tab keeps working; only cross-refresh persistence is
    // lost. Swallow silently to keep the write path safe for the resolver
    // and the switcher.
  }
};

const removeSession = (): void => {
  if (!hasWindow()) {
    return;
  }
  try {
    globalThis.window.sessionStorage.removeItem(APP_MODE_SESSION_KEY);
  } catch {
    // Same rationale as writeSession — a failed clear is not worth
    // surfacing; the in-memory reset in `clearAppMode` still applies.
  }
};

interface AppModeStore {
  currentMode: string;
  setMode: (mode: string) => void;
  reset: () => void;
}

const initialSession = readSession();

export const useAppModeStore = create<AppModeStore>((set) => ({
  currentMode: initialSession?.mode ?? DEFAULT_APP_MODE,
  setMode: (mode) => set({ currentMode: mode }),
  reset: () => set({ currentMode: DEFAULT_APP_MODE }),
}));

export const useAppMode = (): string =>
  useAppModeStore((state) => state.currentMode);

/**
 * Write the active app mode.
 *
 * - Updates the in-memory Zustand store so subscribers re-render.
 * - Writes the `sessionStorage` tuple so refreshes inside the same tab
 *   don't need to re-resolve.
 *
 * `personaAppMode` is the persona-scoping key: it captures what the
 * resolver saw from the persona doc at the moment of write. Callers
 * that don't know the persona value (the switcher, the desktop lock)
 * omit it and the current tuple's `personaAppMode` is preserved.
 */
export const writeAppMode = (
  mode: string,
  personaAppMode?: string | null
): void => {
  const nextPersonaAppMode =
    personaAppMode === undefined
      ? readSession()?.personaAppMode ?? null
      : personaAppMode;

  useAppModeStore.getState().setMode(mode);
  writeSession({ personaAppMode: nextPersonaAppMode, mode });
};

export const clearAppMode = (): void => {
  useAppModeStore.getState().reset();
  removeSession();
};

/**
 * Read the current session tuple. Exposed for the resolver, which needs
 * to compare `personaAppMode` snapshots and decide whether the persisted
 * session is still valid.
 */
export const readAppModeSession = (): AppModeSession | null => readSession();

/**
 * True when a non-default app mode is active (e.g. Collate's AI mode).
 * OM core stays mode-agnostic, so this is a generic "a custom mode is on"
 * check rather than naming a specific mode. Defaults to false whenever the
 * active mode is the default.
 */
export const useIsAiMode = (): boolean => useAppMode() !== DEFAULT_APP_MODE;
