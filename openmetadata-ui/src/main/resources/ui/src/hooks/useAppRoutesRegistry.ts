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

import { ComponentType } from 'react';
import { create } from 'zustand';

/**
 * Runtime registry of authenticated-routes components keyed by AppMode.
 *
 * Downstream consumers (plugins, themes) register a complete routes
 * component for the mode they own at boot. `AppRouter` consults this
 * registry to decide which routes component to mount: if the active
 * mode has a registration, it wins; otherwise OM's built-in
 * `AuthenticatedRoutes` is rendered.
 *
 * The registered component is expected to own its own `<Routes>` block
 * AND any shell chrome (header, sidebar, layout) — i.e., it is the
 * complete app surface for that mode.
 *
 * The default mode is intentionally NOT pre-registered. It's the
 * fallback that runs whenever no other mode is active or registered.
 */

interface AppRoutesRegistryStore {
  routes: Record<string, ComponentType>;
  registerRoutes: (mode: string, component: ComponentType) => void;
  /**
   * Remove a previously-registered mode. Use when the source plugin
   * becomes unavailable mid-session (e.g., admin uninstalls the app)
   * so a subsequent `useAppMode()` switch to that mode falls back to
   * the default `AuthenticatedRoutes` instead of mounting a stale
   * component tree.
   */
  unregisterRoutes: (mode: string) => void;
}

export const useAppRoutesRegistry = create<AppRoutesRegistryStore>((set) => ({
  routes: {},
  registerRoutes: (mode, component) =>
    set((state) => ({ routes: { ...state.routes, [mode]: component } })),
  unregisterRoutes: (mode) =>
    set((state) => {
      if (!(mode in state.routes)) {
        return state;
      }
      const next = { ...state.routes };
      delete next[mode];

      return { routes: next };
    }),
}));
