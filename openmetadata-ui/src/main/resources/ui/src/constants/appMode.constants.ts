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

/**
 * Generic AppMode primitives.
 *
 * The active mode is a string, tracked via `sessionStorage`/`localStorage`
 * and resolved through the precedence chain in `useAppMode.ts`. OSS
 * `AppRouter` renders the AI shell directly when the resolved mode
 * matches `AI_APP_MODE` (see below) — there is no runtime
 * registry or plugin-registration step in between.
 *
 * The active mode is scoped to a tab via `sessionStorage`, keyed by the
 * value below. The stored payload is a tuple:
 *
 *   { personaAppMode: string | null, mode: string }
 *
 * `personaAppMode` snapshots what the resolver saw from the persona doc
 * at write time, so the resolver can tell whether the persona has
 * something new to say (invalidate the session) or not (keep the tab's
 * chosen mode). See `resolveEffectiveAppMode` in `useAppMode.ts` for the
 * precedence logic.
 */

export const APP_MODE_SESSION_KEY = 'omAppMode';

/**
 * Transient cross-tab hint written to `localStorage` alongside every
 * `writeAppMode` call. Lets a freshly-opened tab (which has an empty
 * `sessionStorage`) inherit the mode of a sibling tab when it's within
 * the TTL window — modern browsers do not copy sessionStorage across
 * user-opened tabs even for same-origin links, so without this hint
 * cmd/middle-clicking an AI-only URL from an AI tab lands on Classic
 * and 404s.
 *
 * The hint is NOT the "remember on next login" preference (that stays
 * on `usePersistentStorage[user].appMode`, written only by the switcher
 * checkbox). It's short-lived signalling between concurrent tabs.
 */
export const APP_MODE_HINT_STORAGE_KEY = 'omAppModeHint';

/**
 * Age above which the app-mode hint is treated as absent. Long enough
 * to cover cmd-click → new-tab-load latency; short enough that closing
 * every tab and returning later reads as a fresh session.
 */
export const APP_MODE_HINT_TTL_MS = 60_000;

export const DEFAULT_APP_MODE = 'default';

/**
 * Runtime mode key for the AI app-mode shell. `AppRouter` renders
 * `AppModeRoutes` directly whenever the resolved mode equals this value,
 * and falls back to the default mode's routes otherwise. This identifier
 * also lets the persona-scoped App Mode preference translate the
 * admin-facing `AppMode` enum value into the runtime mode string.
 */
export const AI_APP_MODE = 'ai';
