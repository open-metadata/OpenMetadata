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

import { EXTENSION_POINTS } from '../../utils/ExtensionPointTypes';
import { ExtensionPointRegistry } from '../../utils/ExtensionPointRegistry';
import { CONNECTIONS_ROUTES } from './connections.constants';
import { connectionsModule } from './connections.module';

describe('connectionsModule', () => {
  it('owns the connections prefix and list default path', () => {
    expect(connectionsModule.id).toBe('connections');
    expect(connectionsModule.prefix).toBe(CONNECTIONS_ROUTES.CONNECTIONS);
    expect(connectionsModule.defaultPath).toBe(CONNECTIONS_ROUTES.CONNECTIONS);
  });

  it('registers the list + detail + tab routes', () => {
    const paths = connectionsModule.routes.map((r) => r.path);

    expect(paths).toContain(CONNECTIONS_ROUTES.CONNECTIONS);
    expect(paths).toContain(CONNECTIONS_ROUTES.CONNECTIONS_SERVICE_DETAILS);
    expect(paths).toContain(
      CONNECTIONS_ROUTES.CONNECTIONS_SERVICE_DETAILS_TAB
    );
  });

  it('splices contributed routes AHEAD of the :tab route', () => {
    const registry = new ExtensionPointRegistry();
    registry.contribute({
      extensionPointId: EXTENSION_POINTS.CONNECTIONS_ROUTES,
      data: {
        key: 'agent-job',
        route: { path: CONNECTIONS_ROUTES.AGENT_JOB_DETAILS, element: null },
      },
    });

    const routes = connectionsModule.resolveRoutes(registry);
    const agentIdx = routes.findIndex(
      (r) => r.path === CONNECTIONS_ROUTES.AGENT_JOB_DETAILS
    );
    const tabIdx = routes.findIndex(
      (r) => r.path === CONNECTIONS_ROUTES.CONNECTIONS_SERVICE_DETAILS_TAB
    );

    expect(agentIdx).toBeGreaterThanOrEqual(0);
    expect(agentIdx).toBeLessThan(tabIdx);
  });
});
