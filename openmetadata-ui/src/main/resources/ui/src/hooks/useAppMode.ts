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
  AI_APP_MODE,
  APP_MODE_HINT_STORAGE_KEY,
  APP_MODE_HINT_TTL_MS,
  APP_MODE_SESSION_KEY,
  DEFAULT_APP_MODE,
} from '../constants/appMode.constants';
import { DefaultAppMode } from '../generated/api/configuration/appConfiguration';
import { Document } from '../generated/entity/docStore/document';
import {
  PersonaPreferences,
  UICustomization,
} from '../generated/system/ui/uiCustomization';
import { AppMode } from '../generated/type/personaPreferences';
import { usePersistentStorage } from './currentUserStore/useCurrentUserStore';

/**
 * Payload persisted in `sessionStorage[APP_MODE_SESSION_KEY]`.
 * `personaAppMode` is the value the boot resolver saw from the persona
 * doc when this tuple was last written.
 *
 * `source` records WHO wrote the tuple:
 *   - `'manual'` — a UI toggle (profile dropdown, switcher popover,
 *     plugin click). The user's active choice for this tab; sticky
 *     against a boot re-resolve.
 *   - `'resolver'` — legacy value written by the now-deleted
 *     `useResolvedAppMode` hook. No longer produced, but still accepted
 *     for backward compatibility with tuples persisted before this
 *     refactor; treated as sticky like `'manual'`.
 *   - `'boot'` — `AuthProvider.hydrateAndResolveAppMode`'s write. Now
 *     the authoritative resolve (it resolves persona synchronously
 *     within its fetch before writing), but kept `'boot'` so it stays
 *     re-resolvable on the next reload — a later persona-doc edit takes
 *     effect without needing the session cleared.
 *   - `undefined` — legacy tuples from before this field existed;
 *     treated as `'manual'` (respect them). Backward-compatible.
 *
 * `hydrateAndResolveAppMode`'s "keep the current session" skip only
 * fires when `source !== 'boot'`, so a `'boot'` tuple is re-resolved on
 * every reload while a `'manual'`/`'resolver'` tuple is left untouched.
 */
export type AppModeSessionSource = 'manual' | 'resolver' | 'boot';

export interface AppModeSession {
  personaAppMode: string | null;
  mode: string;
  source?: AppModeSessionSource;
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
      // Preserve `source` when it's one of the known values. Legacy
      // tuples written before this field existed omit it — treat that
      // as "manual" via the resolver's `source !== 'boot'` check.
      const source: AppModeSessionSource | undefined =
        tuple.source === 'manual' ||
        tuple.source === 'resolver' ||
        tuple.source === 'boot'
          ? tuple.source
          : undefined;

      return source
        ? { personaAppMode, mode: tuple.mode, source }
        : { personaAppMode, mode: tuple.mode };
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
    const hasModeAndTsKeys =
      parsed !== null &&
      typeof parsed === 'object' &&
      'mode' in parsed &&
      'ts' in parsed;
    if (
      hasModeAndTsKeys &&
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
// is a shared localStorage key; seeding the in-memory store from it at
// module init would let a stale/foreign hint drive the very first
// render before the boot resolver has had a chance to validate it
// against this user's persona/preference. The boot resolver
// (`AuthProvider.hydrateAndResolveAppMode`) reads the hint safely after
// auth and adopts it via `writeAppMode`, so an empty tuple simply boots
// Classic until that runs.
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
 * `personaAppMode` is the persona-scoping key: it captures what the boot
 * resolver saw from the persona doc at the moment of write. Callers
 * that don't know the persona value (the switcher, the desktop lock)
 * omit it and the current tuple's `personaAppMode` is preserved.
 *
 * `source` records who is writing:
 *   - `'manual'` (default) — a UI toggle; sticky against a boot
 *     re-resolve.
 *   - `'resolver'` — legacy value from the deleted `useResolvedAppMode`
 *     hook; still accepted (sticky) for backward compatibility.
 *   - `'boot'` — `AuthProvider.hydrateAndResolveAppMode`'s authoritative
 *     write; re-resolvable on the next reload.
 *
 * All existing callers (UI switches) default to `'manual'`, so this
 * is a backward-compatible signature change.
 */
export const writeAppMode = (
  mode: string,
  personaAppMode?: string | null,
  options?: { source?: AppModeSessionSource }
): void => {
  const nextPersonaAppMode =
    personaAppMode === undefined
      ? readSession()?.personaAppMode ?? null
      : personaAppMode;
  const source: AppModeSessionSource = options?.source ?? 'manual';

  useAppModeStore.getState().setMode(mode);
  writeSession({ personaAppMode: nextPersonaAppMode, mode, source });
  // Cross-tab hint: sibling / newly-opened tabs read this at boot when
  // their sessionStorage is empty (see APP_MODE_HINT_STORAGE_KEY docs).
  // Do NOT write the hint for `'boot'` writes: a boot-provisional
  // tuple shouldn't leak to sibling tabs as a "user chose this" hint.
  if (source !== 'boot') {
    writeHint(mode);
  }
};

export const clearAppMode = (): void => {
  useAppModeStore.getState().reset();
  removeSession();
  removeHint();
};

/**
 * Clear only this tab's session tuple (and the in-memory store), NOT
 * the cross-tab hint. Used by the resolver's stale-mode cleanup — a
 * single tab discovering that its session's mode is unregistered
 * shouldn't wipe the shared hint that sibling tabs may legitimately
 * be using for cross-tab mode inheritance. The hint has its own TTL
 * and heartbeat guards.
 */
export const clearAppModeSessionOnly = (): void => {
  useAppModeStore.getState().reset();
  removeSession();
};

/**
 * Remove only the sessionStorage tuple; DO NOT touch the in-memory store
 * or the cross-tab hint. Used by the resolver's boot-provisional override
 * — the boot write has already set the store to a best-guess mode, and
 * the resolver is about to overwrite the store via `writeAppMode(candidate)`
 * once it has full context. Zustand notifies subscribers synchronously on
 * every `set`, so calling `.reset()` between the boot write and the
 * resolver's write forces a transient `currentMode === DEFAULT_APP_MODE`
 * render that flips a non-default route ('/ai-automations',
 * '/observability/*', etc.) through the Classic route tree's catch-all
 * and redirects it to `/404` before the resolver's write lands. Leaving
 * the store on boot's value means the only mode change subscribers see
 * is the final resolver value, not an intermediate default.
 */
export const removeAppModeSession = (): void => {
  removeSession();
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
 * True when the active app mode is `AI_APP_MODE`. OM core stays
 * mode-agnostic elsewhere, but this hook names the one specific mode a
 * plugin registers under `'ai'` so AI-only layouts can gate on it directly.
 * False for every other mode, including the default.
 */
export const useIsAiMode = (): boolean => useAppMode() === AI_APP_MODE;

/**
 * Translate the yaml/DB-facing `appConfiguration.defaultAppMode` wire value
 * ("ai" | "classic") into the runtime mode string consumed by `useAppMode`.
 * Core uses `DEFAULT_APP_MODE` ("default") for Classic, while the plugin
 * registers its routes under `AI_APP_MODE` ("ai"); the "classic" wire value
 * is the only one whose runtime string differs from the wire token.
 */
export const CONFIG_MODE_TO_RUNTIME: Record<string, string> = {
  [DefaultAppMode.Classic]: DEFAULT_APP_MODE,
  [DefaultAppMode.AI]: AI_APP_MODE,
};

/**
 * Safe wrapper around {@link CONFIG_MODE_TO_RUNTIME} for the nullable wire
 * value returned by `getAppConfiguration()` / `AppConfiguration.defaultAppMode`.
 */
export const translateWireMode = (
  wireMode: string | null | undefined
): string | null =>
  wireMode ? CONFIG_MODE_TO_RUNTIME[wireMode] ?? null : null;

/**
 * Translates the runtime mode string (`DEFAULT_APP_MODE` / `AI_APP_MODE`)
 * into the wire token persisted in the user's "remember this mode on login"
 * preference (`AppModePreference.config.value`, enum
 * `["ai", "classic", null]` — see
 * `openmetadata-spec/.../api/teams/preferences/appModePreference.json`).
 * Single source of truth for both directions of this translation;
 * {@link PREFERENCE_MODE_TO_RUNTIME} below is its inverse. Consumed by
 * `AppModeSwitcher`'s remember checkbox.
 */
export const RUNTIME_TO_PREFERENCE_WIRE: Record<string, string> = {
  [DEFAULT_APP_MODE]: 'classic',
  [AI_APP_MODE]: 'ai',
};

/**
 * Inverse of {@link RUNTIME_TO_PREFERENCE_WIRE}: translates the stored
 * `appMode` preference wire token (`"ai"` | `"classic"`) back into the
 * runtime mode string consumed by `useAppMode`/`writeAppMode`.
 */
export const PREFERENCE_MODE_TO_RUNTIME: Record<string, string> = {
  classic: DEFAULT_APP_MODE,
  ai: AI_APP_MODE,
};

/**
 * Safe wrapper around {@link PREFERENCE_MODE_TO_RUNTIME} for the nullable
 * wire value read off the user's stored `appMode` preference. Unrecognised
 * tokens pass through unchanged (matches `translateWireMode`'s sibling
 * behavior of not inventing a fallback mode).
 */
export const translatePreferenceMode = (
  wireMode: string | null | undefined
): string | null =>
  wireMode ? PREFERENCE_MODE_TO_RUNTIME[wireMode] ?? wireMode : null;

/**
 * Resolve the runtime app mode a persona forces on login from its
 * UICustomization document. Looks up the `personaPreferences` entry for
 * `personaId` and translates its admin-facing `appMode` (the
 * personaPreferences AppMode enum, `"classic" | "AI"`) into the runtime
 * mode string consumed by `useAppMode`:
 *
 *   - `"classic"` -> `DEFAULT_APP_MODE`
 *   - `"AI"`      -> `AI_APP_MODE`
 *
 * Reuses {@link translatePreferenceMode}, normalising the enum's uppercase
 * `"AI"` to the lowercase `"ai"` wire token that map understands. Returns
 * `null` when there is no doc, no persona, or the
 * persona has no `appMode` set — callers fall through to the next
 * precedence signal (user pref / tenant default).
 *
 * Pure — no side effects. Consumed by `AuthProvider.hydrateAndResolveAppMode`
 * once the persona doc has been fetched at boot.
 */
export const resolvePersonaAppMode = (
  doc: Document | undefined,
  personaId: string | undefined
): string | null => {
  if (!doc || !personaId) {
    return null;
  }
  const preferences = (doc.data as UICustomization | undefined)
    ?.personaPreferences;
  const entry = preferences?.find(
    (p: PersonaPreferences) => p.personaId === personaId
  );
  if (!entry?.appMode) {
    return null;
  }
  const wire = entry.appMode === AppMode.AI ? 'ai' : entry.appMode;

  return translatePreferenceMode(wire);
};

/**
 * Synchronously resolve the app mode a freshly-authenticated user should
 * land in, using the same precedence as
 * {@link resolveEffectiveAppMode} minus the async persona lookup:
 *
 *   1. `sessionStorage` tuple (mid-session re-auth in an already-AI tab)
 *   2. Fresh cross-tab hint (a sibling tab in this browser is in AI)
 *   3. User's stored `preferences.appMode` (the "remember" checkbox)
 *   4. `DEFAULT_APP_MODE`
 *
 * Persona-based resolution requires an API call and is deferred to
 * `AuthProvider.hydrateAndResolveAppMode`, which runs after login and
 * will write the persona-forced mode when the persona disagrees. This
 * helper only exists so the post-login redirect can pick the right
 * landing route (`/` for non-default modes, `/my-data` for Classic)
 * without waiting for that async persona-doc fetch.
 *
 * Pure — no side effects. Safe to call from event handlers.
 */
export const resolveInitialAppMode = (userName?: string): string => {
  // Distinguish "explicit session tuple" from "no session at all" by
  // reading the raw sessionStorage payload. `useAppModeStore.currentMode`
  // returns `DEFAULT_APP_MODE` in BOTH cases, which would let a
  // sibling-tab AI hint override an explicit Classic session — the same
  // session-over-hint precedence the boot resolver enforces.
  const session = readSession();
  if (session) {
    return session.mode;
  }

  const hint = readHint();
  if (isHintFresh(hint) && hint && hint.mode !== DEFAULT_APP_MODE) {
    return hint.mode;
  }

  if (userName) {
    const pref = usePersistentStorage.getState().getUserPreference(userName);
    // `pref.appMode` holds the preference's WIRE token ("classic" /
    // "ai" / legacy "ai"), not the runtime mode string — translate
    // before comparing/returning. See `translatePreferenceMode` and its
    // #31906 follow-up doc comment above.
    const runtimeMode = translatePreferenceMode(pref?.appMode ?? null);
    if (runtimeMode && runtimeMode !== DEFAULT_APP_MODE) {
      return runtimeMode;
    }
  }

  return DEFAULT_APP_MODE;
};

/**
 * Canonical precedence for the "no valid session tuple, no fresh hint"
 * case. Used by `AuthProvider.hydrateAndResolveAppMode` (the boot-time
 * resolver) after it has fetched the persona doc, so the fallback chain
 * lives in exactly one place.
 *
 * Signals, highest precedence first:
 *
 *   1. `userPref`    — the user's own stored preference (`user_preferences`,
 *                       aka the "remember" server-side toggle). A
 *                       persistent user choice made through the switcher.
 *   2. `personaMode` — the admin-curated persona app mode, when known.
 *                       The group-level default for this user's persona.
 *   3. `appDefault`  — the tenant-wide "first impression" default
 *                       (`appConfiguration.defaultAppMode`, translated).
 *   4. `DEFAULT_APP_MODE` — the hardcoded constant, last resort.
 *
 * Not included here (higher-priority signals handled by callers):
 *   - Session tuple (`sessionStorage['omAppMode']`) — the manual in-tab
 *     switch, wins unconditionally when valid. See
 *     `hydrateAndResolveAppMode`'s session-tuple skip.
 *   - Fresh cross-tab hint (`localStorage['omAppModeHint']`) — sits
 *     between session and the chain above. See
 *     `hydrateAndResolveAppMode`.
 *
 * Pure — no side effects, no storage reads. Callers are responsible for
 * supplying each signal (see `AuthProvider`'s bootstrap wiring).
 */
export const resolveEffectiveAppMode = (
  userPref: string | null | undefined,
  personaMode: string | null | undefined,
  appDefault: string | null | undefined
): string => userPref ?? personaMode ?? appDefault ?? DEFAULT_APP_MODE;

// In-memory cache of the tenant-wide app-mode default (already translated
// to the runtime string), populated once at boot from `getAppConfiguration()`
// by `AuthProvider`. Deliberately NOT persisted anywhere — it is a soft
// fallback consulted only when neither the user's preference nor the
// persona have an opinion. See `resolveEffectiveAppMode`, which consults
// it as the third-priority signal.
let appDefaultMode: string | null = null;

export const setAppDefaultMode = (mode: string | null): void => {
  appDefaultMode = mode;
};

export const getAppDefaultMode = (): string | null => appDefaultMode;
