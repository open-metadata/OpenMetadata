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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { RouterProvider } from 'react-aria-components';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  BrowserRouter,
  Route,
  Routes,
  useHref,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { render } from 'vitest-browser-react';
import AuthenticatedAppRouter from '../../components/AppRouter/AuthenticatedAppRouter';
import ApplicationsProvider from '../../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import AirflowStatusProvider from '../../context/AirflowStatusProvider/AirflowStatusProvider';
import AntDConfigProvider from '../../context/AntDConfigProvider/AntDConfigProvider';
import PermissionProvider from '../../context/PermissionProvider/PermissionProvider';
import RuleEnforcementProvider from '../../context/RuleEnforcementProvider/RuleEnforcementProvider';
import { ThemeProvider as UntitledUIThemeProvider } from '../../context/UntitledUIThemeProvider/theme-provider';
import { User } from '../../generated/entity/teams/user';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { ADMIN_USER } from './fixtures/user';

/** Same bridge AuthenticatedApp uses so react-aria links/menus navigate via the router. */
const AriaRouterBridge = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();

  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      {children}
    </RouterProvider>
  );
};

/** Mirrors the router's current URL into the DOM so tests can assert on it. */
const LocationProbe = () => {
  const location = useLocation();

  return (
    <output hidden data-testid="__location">
      {location.pathname + location.search}
    </output>
  );
};

export interface RenderWithAppOptions {
  /** Initial URL, e.g. `/table/svc.db.schema.orders?pageSize=15`. */
  url: string;
  /** Route pattern the page is mounted under, e.g. `/table/:fqn/*`. */
  path: string;
}

/**
 * The subset of AuthenticatedApp's providers a page under test needs. Grows as
 * more pages are covered; each one is the real provider, never a stub.
 */
const AppProviders = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AntDConfigProvider>
        <UntitledUIThemeProvider>
          {/* Production (AppRoot) routes with transitions; Playwright turns
              them off via isPlaywrightEnv(), which hides transition races. */}
          <BrowserRouter useTransitions>
            <AriaRouterBridge>
              <RuleEnforcementProvider>
                <DndProvider backend={HTML5Backend}>
                  {children}
                  <LocationProbe />
                </DndProvider>
              </RuleEnforcementProvider>
            </AriaRouterBridge>
          </BrowserRouter>
        </UntitledUIThemeProvider>
      </AntDConfigProvider>
    </QueryClientProvider>
  );
};

/**
 * A real BrowserRouter on the real window URL, like production. (Several
 * hooks, e.g. useTableFilters, read globalThis.location directly, so a
 * MemoryRouter would diverge from what users get.) setup.ts restores it.
 */
const goTo = (url: string) => globalThis.history.replaceState(null, '', url);

/**
 * Renders one component under a route pattern. Real router, react-query, i18n
 * and styles; only the network is fake (MSW). No component mocks.
 */
export const renderWithApp = (
  ui: ReactNode,
  { url, path }: RenderWithAppOptions
) => {
  goTo(url);

  return render(
    <AppProviders>
      <Routes>
        <Route element={ui} path={path} />
      </Routes>
    </AppProviders>
  );
};

/**
 * Renders the whole signed-in app at a URL through the real
 * AuthenticatedAppRouter, so routing, lazy pages and route params are exactly
 * what production does. Use this for page-level tests.
 */
export const renderApp = (url: string, user: User = ADMIN_USER) => {
  useApplicationStore.setState({
    currentUser: user,
    isAuthenticated: true,
    isAuthenticating: false,
  });
  goTo(url);

  return render(
    <AppProviders>
      <PermissionProvider>
        <ApplicationsProvider>
          <AirflowStatusProvider>
            <AuthenticatedAppRouter />
          </AirflowStatusProvider>
        </ApplicationsProvider>
      </PermissionProvider>
    </AppProviders>
  );
};

export const currentUrl = () =>
  document.querySelector('[data-testid="__location"]')?.textContent ?? '';
