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
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { serveEmptyLists } from '../../test/browser/fixtures/hierarchy';
import { EMPTY_LIST, worker } from '../../test/browser/msw';
import { networkIdle } from '../../test/browser/network';
import { renderApp } from '../../test/browser/renderWithApp';
import { scaled } from '../../test/browser/timeouts';

const SERVICE_A = {
  id: '00000000-0000-4000-8000-0000000000a1',
  name: 'service-a',
  fullyQualifiedName: 'service-a',
  displayName: 'Service A',
  serviceType: 'Mysql',
  connection: { config: {} },
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
};
const SERVICE_B = {
  id: '00000000-0000-4000-8000-0000000000b2',
  name: 'service-b',
  fullyQualifiedName: 'service-b',
  displayName: 'Service B',
  serviceType: 'Mysql',
  connection: { config: {} },
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
};
const RUNNING_INSTANCE_A = {
  id: 'workflow-instance-a',
  status: 'RUNNING',
  startedAt: 1715404800000,
};

const autoPilotButton = () =>
  page.getByTestId('trigger-auto-pilot-application-button');

describe('ServiceDetailsPage workflowStatesData cross-service leak', () => {
  test(
    'clears the previous service AutoPilot run when navigating to a service with no run',
    async () => {
      // Two services served by FQN: the handler returns the one whose FQN matches.
      worker.use(
        http.get('/api/v1/services/databaseServices/name/:fqn', ({ params }) =>
          HttpResponse.json(params.fqn === 'service-b' ? SERVICE_B : SERVICE_A)
        )
      );
      serveEmptyLists(['/api/v1/databases']);
      worker.use(
        // Workflow instances: SERVICE_A gets a RUNNING run, SERVICE_B gets none.
        http.get('/api/v1/governance/workflowInstances', ({ request }) => {
          const url = new URL(request.url);
          const entityLink = url.searchParams.get('entityLink') ?? '';

          return HttpResponse.json(
            entityLink.includes('service-a')
              ? { data: [RUNNING_INSTANCE_A], paging: { total: 1 } }
              : EMPTY_LIST
          );
        }),
        // Fires only when an instance id is found (SERVICE_A).
        http.get('/api/v1/governance/workflowInstanceStates/:name/:id', () =>
          HttpResponse.json(EMPTY_LIST)
        ),
        // The Insights tab reads search + charts/stream.
        http.get('/api/v1/search/query', () =>
          HttpResponse.json({
            hits: { total: { value: 0 }, hits: [] },
            aggregations: {},
          })
        ),
        http.post('/api/v1/analytics/dataInsights/system/charts/stream', () =>
          HttpResponse.json({})
        ),
        http.get(
          '/api/v1/analytics/dataInsights/system/charts/listChartData',
          () => HttpResponse.json({})
        )
      );

      const screen = await renderApp(
        '/service/databaseServices/service-a/insights'
      );

      // SERVICE_A has a RUNNING run: the trigger is disabled, mirroring the
      // "AutoPilot already running" gate that the stale-state leak wrongly
      // keeps active on a no-run service.
      await expect
        .element(autoPilotButton())
        .toBeDisabled({ timeout: scaled(20_000) });

      // Client-side navigation to SERVICE_B: same route element, no remount —
      // the only thing that changes is the :fqn param, exactly as in the app.
      globalThis.history.pushState(
        {},
        '',
        '/service/databaseServices/service-b/insights'
      );
      globalThis.dispatchEvent(new PopStateEvent('popstate'));
      await networkIdle();

      // SERVICE_B's header is now visible — confirms the page re-rendered on
      // the new FQN without remounting.
      await expect
        .element(page.getByRole('heading', { name: /Service B/i }))
        .toBeVisible({ timeout: scaled(20_000) });

      // SERVICE_B has no run: stale SERVICE_A state must not leak, so the
      // trigger is enabled (no "AutoPilot already running").
      await expect
        .element(autoPilotButton())
        .toBeEnabled({ timeout: scaled(20_000) });

      await screen.unmount();
    },
    scaled(120_000)
  );
});
