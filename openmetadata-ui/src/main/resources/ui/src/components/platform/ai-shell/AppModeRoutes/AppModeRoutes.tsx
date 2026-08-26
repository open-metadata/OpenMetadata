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

import { lazy, useMemo } from 'react';
import { Route } from 'react-router-dom';
import { APP_ROUTER_ROUTES } from '../../../../constants/router.constants';
import applicationRoutesClass from '../../../../utils/ApplicationRoutesClassBase';
import { withPageSuspenseFallback } from '../../../AppRouter/withSuspenseFallback';
import { useAppModeRoutesFallback } from '../appModeExtensions';
import { AppShell } from '../AppShell';
import KeepAliveRoutes, {
  KeepAliveRoute,
} from '../KeepAliveRoutes/KeepAliveRoutes';
import { useAllAppModules } from '../sharedAppModules';

// The app-mode shell owns its own /404, mirroring the classic
// `AuthenticatedRoutes`. Without an explicit element the catch-all fallback's
// `Navigate → /404` (from OSS/Collate `AuthenticatedAppRouter`) has nothing to
// render and the page goes blank.
const PageNotFound = withPageSuspenseFallback(
  lazy(() => import('../../../../pages/PageNotFound/PageNotFound'))
);
import { useSyncActiveModule } from '../state/useActiveModule';

/**
 * Top-level routes component for app mode.
 *
 * OSS `AppRouter` renders this shell directly whenever the active
 * `useAppMode()` is the AI mode, in place of OM's default
 * `AuthenticatedRoutes` — there is no runtime registry/plugin-registration
 * step in between. Auth, permissions, applications and `BrowserRouter` are
 * all supplied above by `AuthenticatedApp`/`AppRoot`.
 *
 * The route table is the flat union of every module's `routes` (from
 * `useAllAppModules()` — OSS's `sharedAppModules` merged with the modules
 * every installed `AppPlugin` returns from `getModeModules('ai')`)
 * followed by the `app-mode.routes.fallback` contribution mounted last as
 * the catch-all. Modules arrive via the plugin-native `getModeModules`
 * method; fallback and other chrome (banners, overlays, sidebar slots)
 * still arrive via the `app-mode.*` extension registry — see
 * `appModeExtensions.ts`. This component imports NO plugin code — every
 * AI-exclusive route arrives via a module or the fallback contribution.
 *
 * Sticky active-module state is kept in sync with the URL via
 * `useSyncActiveModule` at the top of the render.
 */
export const AppModeRoutes = () => {
  useSyncActiveModule();
  const modules = useAllAppModules();
  const fallback = useAppModeRoutesFallback();

  // The catch-all page route table. Mirrors how the classic `AppContainer`
  // renders its content: the same `applicationRoutesClass.getRouteElements()`
  // (OSS `AuthenticatedAppRouter`, or `CollateRouter` in Collate), just wrapped
  // in the AI `AppShell` chrome instead of the classic sidebar. So every
  // canonical page (Explore, Glossary, Settings, entity details…) renders
  // inside the shell, and `/` redirects to `/my-data` via that table's own
  // ROUTES.HOME rule. A plugin-contributed fallback still takes precedence.
  const RouteElements = applicationRoutesClass.getRouteElements();

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
        <Route element={<PageNotFound />} path={APP_ROUTER_ROUTES.NOT_FOUND} />
        {fallback ? (
          <Route element={fallback.element} path="/*" />
        ) : (
          <Route element={<RouteElements />} path="/*" />
        )}
      </KeepAliveRoutes>
    </AppShell>
  );
};

export default AppModeRoutes;
