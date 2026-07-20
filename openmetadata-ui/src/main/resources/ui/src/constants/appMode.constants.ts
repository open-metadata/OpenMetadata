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
 * The active mode is a string. OM core stays mode-agnostic — it knows
 * about the abstraction (a current mode value, a registry to look up
 * mode-specific routes, a boot resolver) but never names specific modes.
 * Consumers (plugins, themes) register their modes at runtime through
 * `useAppRoutesRegistry`.
 *
 * The active mode is scoped to a tab via `sessionStorage`, keyed by the
 * value below. The stored payload is a tuple:
 *
 *   { personaAppMode: string | null, mode: string }
 *
 * `personaAppMode` snapshots what the resolver saw from the persona doc
 * at write time, so the resolver can tell whether the persona has
 * something new to say (invalidate the session) or not (keep the tab's
 * chosen mode). See `useResolvedAppMode` for the precedence logic.
 */

export const APP_MODE_SESSION_KEY = 'omAppMode';

export const DEFAULT_APP_MODE = 'default';

/**
 * Runtime mode key registered by the Collate plugin via
 * `useAppRoutesRegistry.registerRoutes('ai', ...)`. Core does not itself
 * know how to render AI routes — this identifier only exists here so the
 * persona-scoped App Mode preference can translate the admin-facing enum
 * value into what plugins listen for. If no plugin registers this key,
 * `AppRouter` falls back to the default mode's routes automatically.
 */
export const AI_APP_MODE = 'ai';
