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
  APP_MODE_HINT_STORAGE_KEY,
  APP_MODE_HINT_TTL_MS,
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

/**
 * Transient cross-tab hint payload persisted in
 * `localStorage[APP_MODE_HINT_STORAGE_KEY]`. Written on every
 * `writeAppMode`; read by the boot resolver when the tab has no
 * sessionStorage tuple (fresh tab opened from an existing one). Not a
 * durable preference — the TTL rejects hints older than
 * `APP_MODE_HINT_TTL_MS`, so a full browser restart / long idle reads
 * as a clean slate. See `APP_MODE_HINT_STORAGE_KEY` docs.
 */
export interface AppModeHint {
  mode: string;
  ts: number;
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

const readHint = (): AppModeHint | null => {
  if (!hasWindow()) {
    return null;
  }
  let raw: string | null = null;
  try {
    raw = globalThis.window.localStorage.getItem(APP_MODE_HINT_STORAGE_KEY);
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
      'ts' in parsed &&
      typeof (parsed as AppModeHint).mode === 'string' &&
      typeof (parsed as AppModeHint).ts === 'number'
    ) {
      return parsed as AppModeHint;
    }
  } catch {
    // fall through — malformed payloads are treated as absent
  }

  return null;
};

const writeHint = (mode: string): void => {
  if (!hasWindow()) {
    return;
  }
  try {
    globalThis.window.localStorage.setItem(
      APP_MODE_HINT_STORAGE_KEY,
      JSON.stringify({ mode, ts: Date.now() })
    );
  } catch {
    // Storage disabled / quota exceeded — cross-tab mode inheritance
    // silently degrades. Tabs still work independently.
  }
};

const removeHint = (): void => {
  if (!hasWindow()) {
    return;
  }
  try {
    globalThis.window.localStorage.removeItem(APP_MODE_HINT_STORAGE_KEY);
  } catch {
    // Same rationale as writeHint.
  }
};

const isHintFresh = (hint: AppModeHint | null): boolean =>
  hint !== null && Date.now() - hint.ts < APP_MODE_HINT_TTL_MS;

interface AppModeStore {
  currentMode: string;
  setMode: (mode: string) => void;
  reset: () => void;
}

const initialSession = readSession();
// Only hydrate the in-memory store from the sessionStorage tuple at
// module load — do NOT fall back to the cross-tab hint here. The hint
// is a shared localStorage key and its mode may not be registered in
// this tab (App.tsx installs the AI route in its own effect, which
// hasn't run at module init). Seeding the store with an unregistered
// mode causes `useAppMode()` to return e.g. `'ai'` on the first render
// while the registry is still empty, so AI-only layouts try to render
// against the Classic route tree — a "flash of broken AI" that's
// worse than the "flash of Classic" it was trying to avoid. The
// resolver (`useResolvedAppMode`) reads the hint safely, gated on
// registration, and adopts it via `writeAppMode` once the AI route
// registers.
const initialMode = initialSession?.mode ?? DEFAULT_APP_MODE;

export const useAppModeStore = create<AppModeStore>((set) => ({
  currentMode: initialMode,
  setMode: (mode) => set({ currentMode: mode }),
  reset: () => set({ currentMode: DEFAULT_APP_MODE }),
}));

// Heartbeat: refresh the hint's timestamp on a fixed interval so a tab
// that's alive but idle (no writes) keeps the hint fresh for sibling /
// new tabs. Without this, a user reading the page for longer than
// APP_MODE_HINT_TTL_MS would see a stale hint and any cmd-clicked
// new tab would boot Classic and 404 on AI-only URLs. Fires at half
// the TTL so worst-case staleness is ~ (TTL / 2). Also refresh on
// visibility change so a tab returning from background updates
// immediately without waiting for the interval.
const HEARTBEAT_INTERVAL_MS = Math.floor(APP_MODE_HINT_TTL_MS / 2);

const refreshHint = (): void => {
  const mode = useAppModeStore.getState().currentMode;
  // A tab in the default (Classic) mode has nothing worth propagating
  // — DEFAULT is the resolver's own fallback, so a fresh hint of
  // `'default'` provides no information a sibling tab wouldn't reach
  // on its own. Worse, the hint is a single shared localStorage key,
  // so an idle Classic tab's heartbeat would nondeterministically
  // overwrite an `'ai'` hint that a sibling AI tab just wrote,
  // stranding the next cmd-clicked new tab in Classic — the exact
  // regression the hint exists to prevent. Explicit switches
  // (writeAppMode) still write the hint for both modes so a user
  // going AI → Classic correctly updates the hint to `'default'`.
  if (mode === DEFAULT_APP_MODE) {
    return;
  }
  writeHint(mode);
};

if (hasWindow()) {
  globalThis.window.setInterval(refreshHint, HEARTBEAT_INTERVAL_MS);
  globalThis.window.addEventListener('visibilitychange', () => {
    if (globalThis.document.visibilityState === 'visible') {
      refreshHint();
    }
  });
  globalThis.window.addEventListener('focus', refreshHint);
}

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
  // Cross-tab hint: sibling / newly-opened tabs read this at boot when
  // their sessionStorage is empty (see APP_MODE_HINT_STORAGE_KEY docs).
  writeHint(mode);
};

export const clearAppMode = (): void => {
  useAppModeStore.getState().reset();
  removeSession();
  removeHint();
};

/**
 * Read the current session tuple. Exposed for the resolver, which needs
 * to compare `personaAppMode` snapshots and decide whether the persisted
 * session is still valid.
 */
export const readAppModeSession = (): AppModeSession | null => readSession();

/**
 * Read the cross-tab mode hint. Exposed for the resolver so a newly-
 * opened tab (empty sessionStorage) can adopt the mode of a sibling
 * tab that wrote the hint within the TTL window.
 */
export const readAppModeHint = (): AppModeHint | null => readHint();

/**
 * True when the given hint is present and still within its TTL window.
 * Exposed so consumers (resolver) share the same freshness rule as the
 * initial in-memory hydration below.
 */
export const isAppModeHintFresh = (hint: AppModeHint | null): boolean =>
  isHintFresh(hint);

/**
 * True when a non-default app mode is active (e.g. Collate's AI mode).
 * OM core stays mode-agnostic, so this is a generic "a custom mode is on"
 * check rather than naming a specific mode. Defaults to false whenever the
 * active mode is the default.
 */
export const useIsAiMode = (): boolean => useAppMode() !== DEFAULT_APP_MODE;
