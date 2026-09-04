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

import { CONNECTIONS_ROUTES } from '../../../integration/connections.constants';
import { connectionsModule } from '../../../integration/connections.module';
import { ExtensionPointRegistry } from '../../../../utils/ExtensionPointRegistry';
import { EXTENSION_POINTS } from '../../../../utils/ExtensionPointTypes';
import { AppModule } from '../AppModule.types';
import { resolveAppModuleRoutes } from './AppModeRoutes.utils';

const buildModule = (overrides: Partial<AppModule> = {}): AppModule => ({
  id: 'plain',
  navOrder: 10,
  labelKey: 'label.plain',
  prefix: '/plain',
  defaultPath: '/plain',
  routes: [{ path: '/plain', element: null }],
  ...overrides,
});

describe('resolveAppModuleRoutes', () => {
  it('flattens routes from a module with no resolveRoutes', () => {
    const routes = resolveAppModuleRoutes([buildModule()]);

    expect(routes.map((r) => r.path)).toEqual(['/plain']);
  });

  it('falls back to routes when no registry is supplied, even if resolveRoutes exists', () => {
    const resolveRoutes = jest.fn();
    const module = buildModule({ resolveRoutes });

    const routes = resolveAppModuleRoutes([module]);

    expect(resolveRoutes).not.toHaveBeenCalled();
    expect(routes.map((r) => r.path)).toEqual(['/plain']);
  });

  it('calls resolveRoutes with the registry when both are present', () => {
    const registry = new ExtensionPointRegistry();
    const resolveRoutes = jest
      .fn()
      .mockReturnValue([{ path: '/plain/resolved', element: null }]);
    const module = buildModule({ resolveRoutes });

    const routes = resolveAppModuleRoutes([module], registry);

    expect(resolveRoutes).toHaveBeenCalledWith(registry);
    expect(routes.map((r) => r.path)).toEqual(['/plain/resolved']);
  });

  it('mounts a CONNECTIONS_ROUTES contribution (e.g. Collate AgentJob) in the built table', () => {
    const registry = new ExtensionPointRegistry();
    registry.contribute({
      extensionPointId: EXTENSION_POINTS.CONNECTIONS_ROUTES,
      data: {
        key: 'agent-job',
        route: { path: CONNECTIONS_ROUTES.AGENT_JOB_DETAILS, element: null },
      },
    });

    const routes = resolveAppModuleRoutes([connectionsModule], registry);
    const paths = routes.map((r) => r.path);

    expect(paths).toContain(CONNECTIONS_ROUTES.AGENT_JOB_DETAILS);
    expect(paths.indexOf(CONNECTIONS_ROUTES.AGENT_JOB_DETAILS)).toBeLessThan(
      paths.indexOf(CONNECTIONS_ROUTES.CONNECTIONS_SERVICE_DETAILS_TAB)
    );
  });
});
