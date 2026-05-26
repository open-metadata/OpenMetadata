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

import { ComponentType } from 'react';
import { create } from 'zustand';
import { AppMode } from './useAppMode';

/**
 * Runtime registration for non-default app modes. OM core stays mode-
 * agnostic — it knows about the abstraction (sidebar override, plugin
 * route gating, path classification, container style) but never names
 * specific modes. Consumers (e.g. plugins) call `registerMode()` once at
 * boot to wire their mode's behaviour.
 */
export interface AppModeConfig {
  /**
   * Name of the plugin whose APP-position routes belong to this mode.
   * AuthenticatedRoutes uses this to decide which plugin's routes to
   * gate behind the mode/path filter.
   */
  pluginName: string;

  /**
   * Path patterns owned exclusively by this mode (no OM/Collate route at
   * the same URL). Visiting one auto-engages the mode, and the plugin's
   * routes mount regardless of the currently-stored mode.
   */
  uniquePathPatterns: string[];

  /**
   * Legacy URL prefix this mode previously occupied. Plugin routes whose
   * path starts with this prefix stay mounted in every mode so old
   * bookmarks still resolve through the plugin's own redirect.
   */
  legacyPathPrefix?: string;

  /**
   * Sidebar component shown when this mode is active. Replaces the
   * default `AppSidebar` selection.
   */
  sidebar?: ComponentType;

  /**
   * CSS class applied to `.app-container` while this mode is active.
   * Lets the consumer style the shell (background, padding, radius)
   * without OM having to know about it.
   */
  containerClassName?: string;
}

interface AppModeRegistryStore {
  modes: Record<AppMode, AppModeConfig>;
  registerMode: (mode: AppMode, config: AppModeConfig) => void;
}

export const useAppModeRegistry = create<AppModeRegistryStore>((set) => ({
  modes: {},
  registerMode: (mode, config) =>
    set((state) => ({ modes: { ...state.modes, [mode]: config } })),
}));
