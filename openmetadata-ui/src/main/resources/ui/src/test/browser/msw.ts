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
import { setupWorker } from 'msw/browser';
import { ResourceEntity } from '../../enums/permissions.enum';
import { Operation } from '../../generated/entity/policies/policy';

/** What the server answers for an admin: every operation allowed. */
export const allowAll = (resource = 'all') => ({
  resource,
  permissions: Object.values(Operation).map((operation) => ({
    operation,
    access: 'allow',
  })),
});

/**
 * Baseline handlers every UI integration test gets for free. Tests add their
 * own with `worker.use(...)` for the endpoints they assert on. Anything not
 * handled fails loudly so a missing mock never silently hits the network.
 */
export const EMPTY_LIST = { data: [], paging: { total: 0 } };

export const defaultHandlers = [
  http.get('/api/v1/system/config/*', () => HttpResponse.json({})),
  http.get('/api/v1/system/settings/entityRulesSettings/*', () =>
    HttpResponse.json([])
  ),
  http.get('/api/v1/dataQuality/testSuites/executionSummary', () =>
    HttpResponse.json({ columnTestSummary: [] })
  ),
  http.get('/api/v1/permissions', () =>
    HttpResponse.json({ data: Object.values(ResourceEntity).map(allowAll) })
  ),
  http.get('/api/v1/permissions/*', () => HttpResponse.json(allowAll())),
  http.get('/api/v1/learning/resources', () =>
    HttpResponse.json({ data: [], paging: { total: 0 } })
  ),
  http.get('/api/v1/feed/count', () => HttpResponse.json([])),
  // Usage counts and facets; pages render fine with none.
  http.post('/api/v1/search/aggregate', () =>
    HttpResponse.json({
      hits: { total: { value: 0 }, hits: [] },
      aggregations: {},
    })
  ),
  // Entity-page chrome: activity, announcements, conversations, tasks and
  // contracts. Pages under test render with none of them.
  http.get('/api/v1/activity/*', () => HttpResponse.json(EMPTY_LIST)),
  http.get('/api/v1/announcements', () => HttpResponse.json(EMPTY_LIST)),
  http.get('/api/v1/conversations', () => HttpResponse.json(EMPTY_LIST)),
  http.get('/api/v1/contextCenter/pages', () => HttpResponse.json(EMPTY_LIST)),
  http.get('/api/v1/tasks', () => HttpResponse.json(EMPTY_LIST)),
  http.get('/api/v1/tasks/count', () =>
    HttpResponse.json({ open: 0, completed: 0, total: 0 })
  ),
  http.get('/api/v1/dataContracts/entity', () =>
    HttpResponse.json({ code: 404, message: 'No contract' }, { status: 404 })
  ),
  // App shell: installed apps, pipeline service health, agents.
  http.get('/api/v1/apps/installed', () => HttpResponse.json([])),
  http.get('/api/v1/services/ingestionPipelines/status', () =>
    HttpResponse.json({ code: 200, platform: 'airflow', version: '2.10' })
  ),
  http.get(
    '/api/v1/services/ingestionPipelines/progress/*',
    () => new HttpResponse(null, { status: 204 })
  ),
  http.get('/api/v1/services/ingestionPipelines/ip', () =>
    HttpResponse.json({ ip: '127.0.0.1' })
  ),
  http.get('/api/v1/services/ingestionPipelines', () =>
    HttpResponse.json(EMPTY_LIST)
  ),
  http.get('/api/v1/governance/workflowInstances', () =>
    HttpResponse.json(EMPTY_LIST)
  ),
  // OSS has no plan limits.
  http.get('/api/v1/limits/features/:resource', () =>
    HttpResponse.json({ featureLimitStatuses: [] })
  ),
  http.get('/api/v1/changeSummary/*', () =>
    HttpResponse.json({ changeSummary: {} })
  ),
  // Approval workflows: none enforced, no open change requests.
  http.get('/api/v1/metadata/types/workflows/approvalEnforcedEntityTypes', () =>
    HttpResponse.json([])
  ),
  http.get('/api/v1/changeRequests', () => HttpResponse.json(EMPTY_LIST)),
  http.get('/api/v1/metadata/types/name/:name', ({ params }) =>
    HttpResponse.json({ name: params.name, customProperties: [] })
  ),
];

export const worker = setupWorker(...defaultHandlers);
