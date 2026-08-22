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

import { useMemo } from 'react';
import { Route } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { useAppModeRoutesFallback } from '../appModeExtensions';
import KeepAliveRoutes, {
  KeepAliveRoute,
} from '../KeepAliveRoutes/KeepAliveRoutes';
import { useAllAppModules } from '../sharedAppModules';
import { useSyncActiveModule } from '../state/useActiveModule';

/**
 * Top-level routes component for app mode.
 *
 * Registered by a plugin with OM's `useAppRoutesRegistry` so that when the
 * active `useAppMode()` matches the plugin's mode, `AppRouter` mounts this in
 * place of OM's default `AuthenticatedRoutes`. Auth, permissions, applications
 * and `BrowserRouter` are all supplied above by `AuthenticatedApp`/`AppRoot`.
 *
 * The route table is the flat union of every module's `routes` (from
 * `useAllAppModules()` — shared ⊕ contributed) followed by the
 * `app-mode.routes.fallback` contribution mounted last as the catch-all.
 * This component imports NO plugin code — every AI-exclusive route arrives via
 * a module or the fallback contribution.
 *
 * Sticky active-module state is kept in sync with the URL via
 * `useSyncActiveModule` at the top of the render.
 */
export const AppModeRoutes = () => {
  useSyncActiveModule();
  const modules = useAllAppModules();
  const fallback = useAppModeRoutesFallback();

  const routes: KeepAliveRoute[] = useMemo(
    () =>
      modules.flatMap((m) =>
        m.routes.map((route) => ({
          element: route.element,
          path: route.path,
          children: route.children,
        }))
      ),
    [modules]
  );

  return (
    <AppShell>
      <KeepAliveRoutes routes={routes}>
        {fallback ? (
          <Route element={fallback.element} path="/*" />
        ) : null}
      </KeepAliveRoutes>
    </AppShell>
  );
};

export default AppModeRoutes;
