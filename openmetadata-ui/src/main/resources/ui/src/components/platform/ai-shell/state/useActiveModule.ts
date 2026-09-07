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

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { ROUTES } from '../../../../constants/constants';
import { AppModule, AppModuleId } from '../AppModule.types';
import { useAllAppModules } from '../sharedAppModules';

interface ActiveModuleStore {
  activeModule: AppModuleId | null;
  setActiveModule: (id: AppModuleId | null) => void;
}

/**
 * In-memory store of the app module the user most recently entered.
 * Module-less pages (e.g. `/table/<fqn>`) keep the sticky value so the
 * sidebar's sub-nav doesn't collapse mid-flow. Home (`/`) is the one
 * exception — it clears the store to give home a fresh view.
 */
export const useActiveModuleStore = create<ActiveModuleStore>((set) => ({
  activeModule: null,
  setActiveModule: (id) => set({ activeModule: id }),
}));

const isPathUnderPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Pure helper: the module (from `modules`) whose `prefix` or one of its
 * `additionalPrefixes` owns `pathname`, or `null`. Exposed for non-store
 * consumers (navConfig, useActiveNavKey) that compute a module from a
 * pathname without consulting the store.
 */
export const matchModuleByPathname = (
  pathname: string,
  modules: AppModule[]
): AppModuleId | null => {
  const matched = modules.find((m) => {
    const prefixes = [m.prefix, ...(m.additionalPrefixes ?? [])];

    return prefixes.some((p) => isPathUnderPrefix(pathname, p));
  });

  return matched?.id ?? null;
};

/**
 * Module-less, top-level nav routes with no `subNav` of their own — landing
 * on any of these resets the sticky `activeModule` so a previously-open
 * sub-nav doesn't stay open.
 */
const SUB_NAV_RESET_PREFIXES: string[] = [ROUTES.EXPLORE, ROUTES.SETTINGS];

/**
 * Mount once at the top of the app-mode shell. Resets `activeModule` on
 * every fresh mount (prevents stale carry-over from a prior session), then
 * keeps it in sync with the URL on each pathname change.
 */
export const useSyncActiveModule = () => {
  const { pathname } = useLocation();
  const modules = useAllAppModules();
  const setActiveModule = useActiveModuleStore((s) => s.setActiveModule);

  useEffect(() => {
    setActiveModule(null);
  }, [setActiveModule]);

  useEffect(() => {
    const matched = matchModuleByPathname(pathname, modules);
    if (matched) {
      setActiveModule(matched);
    } else if (
      // Home ('/') is exact-only: startsWith('/') would match every path.
      pathname === ROUTES.HOME ||
      SUB_NAV_RESET_PREFIXES.some((prefix) =>
        isPathUnderPrefix(pathname, prefix)
      )
    ) {
      // Entity/shared pages (e.g. /table/<fqn>) retain the sticky module so
      // the sub-nav stays open; only Home and the routes above reset it.
      setActiveModule(null);
    }
  }, [pathname, modules, setActiveModule]);
};
