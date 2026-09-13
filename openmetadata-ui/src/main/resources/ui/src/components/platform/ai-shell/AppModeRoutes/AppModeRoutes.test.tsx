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

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getInstalledApplicationList } from '../../../../rest/applicationAPI';
import leftSidebarClassBase from '../../../../utils/LeftSidebarClassBase';
import { CONNECTIONS_ROUTES } from '../../../integration/connections.constants';
import { connectionsModule } from '../../../integration/connections.module';
import ApplicationsProvider from '../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { AppModeRoutes } from './AppModeRoutes';

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(),
}));
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));
jest.mock('../../../../rest/applicationAPI', () => ({
  getInstalledApplicationList: jest.fn(),
}));

// A fake installed plugin whose `contributeExtensions` adds a
// `CONNECTIONS_ROUTES` (AgentJob) contribution — this is the exact shape of
// Collate's real contribution once B1's route-contribution resolver is used
// downstream. Read via `jest.requireActual` inside the factory (rather than
// closing over top-level imports) because a `jest.mock` factory may not
// reference out-of-scope variables that don't start with `mock`.
jest.mock(
  '../../../Settings/Applications/AppDetails/ApplicationsClassBase',
  () => {
    const { EXTENSION_POINTS } = jest.requireActual(
      '../../../../utils/ExtensionPointTypes'
    );
    const { CONNECTIONS_ROUTES: ROUTES } = jest.requireActual(
      '../../../integration/connections.constants'
    );

    class TestConnectionsAppPlugin {
      name: string;
      isInstalled: boolean;

      constructor(name: string, isInstalled: boolean) {
        this.name = name;
        this.isInstalled = isInstalled;
      }

      contributeExtensions(registry: {
        contribute: (contribution: unknown) => void;
      }) {
        registry.contribute({
          extensionPointId: EXTENSION_POINTS.CONNECTIONS_ROUTES,
          data: {
            key: 'agent-job',
            route: { path: ROUTES.AGENT_JOB_DETAILS, element: null },
          },
        });
      }
    }

    return {
      __esModule: true,
      default: {
        appPluginRegistry: {
          'test-connections-plugin': TestConnectionsAppPlugin,
        },
      },
    };
  }
);

// Records every `routes` prop KeepAliveRoutes is mounted/updated with, so the
// test can assert both (a) the eventual contents of the mounted route table
// and (b) that the table's array reference is stable across an unrelated
// re-render (i.e. the fix doesn't recompute — and therefore doesn't remount
// route pages — on every render).
const mockKeepAliveRoutesRender = jest.fn();

jest.mock('../KeepAliveRoutes/KeepAliveRoutes', () => ({
  __esModule: true,
  default: ({ routes }: { routes: Array<{ path?: string | string[] }> }) => {
    mockKeepAliveRoutesRender(routes);

    return (
      <div data-testid="mounted-routes">
        {routes.map((route) => {
          const pathKey = Array.isArray(route.path)
            ? route.path.join(',')
            : route.path ?? '';

          return (
            <span data-testid="route-path" key={pathKey}>
              {pathKey}
            </span>
          );
        })}
      </div>
    );
  },
}));

jest.mock('../AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUsePermissionProvider = usePermissionProvider as jest.Mock;
const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;
const mockGetInstalledApplicationList =
  getInstalledApplicationList as jest.Mock;

const renderAppModeRoutes = () =>
  render(
    <MemoryRouter initialEntries={[CONNECTIONS_ROUTES.CONNECTIONS]}>
      <ApplicationsProvider>
        <AppModeRoutes />
      </ApplicationsProvider>
    </MemoryRouter>
  );

describe('AppModeRoutes — contribution lifecycle', () => {
  const originalModules = leftSidebarClassBase.getAppModeModules();

  beforeEach(() => {
    jest.clearAllMocks();
    leftSidebarClassBase.setAppModeModules([connectionsModule]);
    mockUsePermissionProvider.mockReturnValue({ permissions: { app: {} } });
    mockUseApplicationStore.mockReturnValue({
      setApplicationsName: jest.fn(),
      setApplicationsLoaded: jest.fn(),
    });
    mockGetInstalledApplicationList.mockResolvedValue([
      { id: 'test-app-id', name: 'test-connections-plugin' },
    ] as EntityReference[]);
  });

  afterEach(() => {
    leftSidebarClassBase.setAppModeModules(originalModules);
  });

  it('mounts a CONNECTIONS_ROUTES contribution once the plugin-install effect settles, and stays stable afterwards', async () => {
    const { rerender } = renderAppModeRoutes();

    // Real lifecycle: ApplicationsProvider fetches the installed-app list,
    // resolves it to a plugin class, and only THEN runs `contributeExtensions`
    // in a follow-up effect. `waitFor` spans that whole async chain.
    await waitFor(() => {
      expect(
        screen.getByText(CONNECTIONS_ROUTES.AGENT_JOB_DETAILS)
      ).toBeInTheDocument();
    });

    // The contributed route must land ahead of the generic `:tab` route so
    // its more specific path wins react-router matching (same ordering
    // connections.module.test.tsx checks in isolation — this proves it
    // survives the real async contribution timing too).
    const paths = screen
      .getAllByTestId('route-path')
      .map((el) => el.textContent);
    const agentIdx = paths.indexOf(CONNECTIONS_ROUTES.AGENT_JOB_DETAILS);
    const tabIdx = paths.indexOf(
      CONNECTIONS_ROUTES.CONNECTIONS_SERVICE_DETAILS_TAB
    );

    expect(agentIdx).toBeGreaterThanOrEqual(0);
    expect(agentIdx).toBeLessThan(tabIdx);

    const callsAfterSettling = mockKeepAliveRoutesRender.mock.calls.length;
    const routesAfterSettling =
      mockKeepAliveRoutesRender.mock.calls[callsAfterSettling - 1][0];

    // Force an unrelated re-render of the whole tree (same props/state) —
    // this must NOT cause the route table to be recomputed (a new array
    // reference would mean KeepAliveRoutes gets new route elements every
    // render, which is what would remount already-mounted route pages).
    rerender(
      <MemoryRouter initialEntries={[CONNECTIONS_ROUTES.CONNECTIONS]}>
        <ApplicationsProvider>
          <AppModeRoutes />
        </ApplicationsProvider>
      </MemoryRouter>
    );

    const callsAfterRerender = mockKeepAliveRoutesRender.mock.calls.length;
    const routesAfterRerender =
      mockKeepAliveRoutesRender.mock.calls[callsAfterRerender - 1][0];

    expect(routesAfterRerender).toBe(routesAfterSettling);
  });
});
