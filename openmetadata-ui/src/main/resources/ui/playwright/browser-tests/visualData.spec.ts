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
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { expect, test } from '../support/fixtures/base';
import { installVisualData, VISUAL_ENTITIES } from '../utils/visualData';

let server: Server;
let origin: string;
let mutations: string[] = [];
let upgrades = 0;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.method !== 'GET') mutations.push(request.url ?? '');
    response.setHeader(
      'Content-Type',
      request.url === '/' ? 'text/html' : 'application/json'
    );
    response.end(
      request.url === '/'
        ? '<title>Visual fixture</title>'
        : JSON.stringify({
            id: 'authenticated-account',
            name: 'authenticated_admin',
            isAdmin: true,
            lastLoginTime: Date.now(),
          })
    );
  });
  server.on('upgrade', (_request, socket) => {
    upgrades++;
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

test.beforeEach(async ({ page }) => {
  mutations = [];
  upgrades = 0;
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
});

test('catalog fixtures isolate the signed-in account from live user reads', async ({
  page,
}) => {
  await installVisualData(page);
  const user = await page.evaluate(async () =>
    (await fetch('/api/v1/users/loggedInUser')).json()
  );
  expect(user).toMatchObject({
    id: '00000000-0000-4000-8000-000000000999',
    name: 'admin',
    isAdmin: true,
    lastLoginTime: 1768471200000,
  });
});

test('a catalog failure does not replace the authenticated account', async ({
  page,
}) => {
  await installVisualData(page, 'error');
  const status = await page.evaluate(
    async () => (await fetch('/api/v1/users/loggedInUser')).status
  );
  expect(status).toBe(200);
});

for (const endpoint of [
  '/api/v1/tables',
  '/api/v1/lineage/getLineage',
  '/api/v1/a-new-write-endpoint',
]) {
  test(`mutations never reach the backend: ${endpoint}`, async ({ page }) => {
    await installVisualData(page);
    const result = await page.evaluate(async (path) => {
      const response = await fetch(path, { method: 'POST', body: '{}' });
      return { status: response.status, body: await response.json() };
    }, endpoint);
    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      message: 'The visual fixture service is unavailable.',
    });
    expect(mutations).toEqual([]);
  });
}

test('metadata type identity and custom-property response shapes match the forms', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    type: await (await fetch('/api/v1/metadata/types/name/table')).json(),
    properties: await (
      await fetch('/api/v1/metadata/types/name/table/customProperties')
    ).json(),
    allProperties: await (
      await fetch('/api/v1/metadata/types/customProperties')
    ).json(),
  }));
  expect(result.type).toMatchObject({
    name: 'table',
    fullyQualifiedName: 'table',
    customProperties: [],
  });
  expect(result.properties).toEqual([]);
  expect(result.allProperties).toEqual({});
});

test('Drive detail requests resolve through their actual REST namespace', async ({
  page,
}) => {
  await installVisualData(page);
  const directory = VISUAL_ENTITIES.find(({ type }) => type === 'directory');
  expect(directory).toBeDefined();
  const result = await page.evaluate(
    async (fqn) =>
      (await fetch(`/api/v1/drives/directories/name/${fqn}`)).json(),
    directory?.entity.fullyQualifiedName
  );
  expect(result).toMatchObject({ displayName: 'Finance directory' });
});

test('table columns load by ID and FQN rather than an empty child response', async ({
  page,
}) => {
  await installVisualData(page);
  const table = VISUAL_ENTITIES.find(({ type }) => type === 'table');
  if (!table) throw new Error('A table fixture is required.');
  const rows = await page.evaluate(
    async ({ id, fullyQualifiedName }) =>
      Promise.all(
        [id, `name/${fullyQualifiedName}`].map(
          async (key) =>
            (
              await (await fetch(`/api/v1/tables/${key}/columns`)).json()
            ).data
        )
      ),
    table.entity
  );
  for (const columns of rows)
    expect(columns.map((column: { name: string }) => column.name)).toEqual([
      'order_id',
      'revenue',
      'customer',
    ]);
});

test('nested application collections and classification filters stay distinct', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    tiers: await (await fetch('/api/v1/tags?parent=Tier')).json(),
    certifications: await (
      await fetch('/api/v1/tags?parent=Certification')
    ).json(),
    app: await (
      await fetch('/api/v1/apps/marketplace/name/AutoPilotApplication')
    ).json(),
  }));
  expect(result.tiers.data.map((tag: { name: string }) => tag.name)).toEqual([
    'Tier1',
    'Tier2',
    'Tier3',
  ]);
  expect(
    result.certifications.data.map((tag: { name: string }) => tag.name)
  ).toEqual(['Gold', 'Silver', 'Bronze']);
  expect(result.app).toMatchObject({
    name: 'AutoPilotApplication',
    appType: 'internal',
  });
});

test('read-only fixtures remove administrator and edit privileges', async ({
  page,
}) => {
  await installVisualData(page, 'read-only');
  const result = await page.evaluate(async () => ({
    user: await (await fetch('/api/v1/users/loggedInUser')).json(),
    permissions: await (await fetch('/api/v1/permissions/table')).json(),
  }));
  expect(result.user.isAdmin).toBe(false);
  expect(result.permissions.permissions).toContainEqual({
    operation: 'ViewAll',
    access: 'allow',
  });
  expect(result.permissions.permissions).toContainEqual({
    operation: 'EditAll',
    access: 'deny',
  });
});

test('read-only POST reports and facets never reach the backend', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    report: await (
      await fetch('/api/v1/dataQuality/testSuites/dataQualityReport/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            { key: 'coverage', index: 'table', aggregationQuery: '{}' },
          ],
        }),
      })
    ).json(),
    facets: await (
      await fetch('/api/v1/search/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldName: 'tier.tagFQN' }),
      })
    ).json(),
    cases: await (
      await fetch('/api/v1/dataQuality/testCases/search/list')
    ).json(),
  }));
  expect(result.report.results[0]).toMatchObject({
    key: 'coverage',
    report: { data: [] },
  });
  expect(
    result.facets.aggregations['tier.tagFQN'].buckets.map(
      (bucket: { key: string }) => bucket.key
    )
  ).toEqual(['Tier.Tier1', 'Tier.Tier2']);
  expect(result.cases.data).toHaveLength(2);
  expect(mutations).toEqual([]);
});

test('ontology library and publication APIs use their non-entity response shapes', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    library: await (await fetch('/api/v1/ontologyPacks')).json(),
    diff: await (
      await fetch('/api/v1/ontologies/visual-ontology/working/diff')
    ).json(),
    state: await (
      await fetch('/api/v1/ontologies/visual-ontology/state')
    ).json(),
  }));
  expect(result.library.packs).toHaveLength(6);
  expect(result.library.packs.map((pack: { id: string }) => pack.id)).toContain(
    'fibo'
  );
  expect(result.diff.state).toEqual(result.state);
  expect(result.diff.paging.total).toBe(0);
});

test('bootstrap and scoped rules do not depend on a live user or configuration service', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    auth: await (await fetch('/api/v1/system/config/auth')).json(),
    rules: await (
      await fetch('/api/v1/system/settings/entityRulesSettings/table')
    ).json(),
    preferences: await (
      await fetch('/api/v1/users/visual-user/preferences')
    ).json(),
    report: await (
      await fetch('/api/v1/dataQuality/testSuites/dataQualityReport/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              key: 'coverage',
              aggregationQuery:
                'bucketName=entityWithTests:aggType=cardinality:field=originEntityFQN',
            },
          ],
        }),
      })
    ).json(),
  }));
  expect(result.auth.provider).toBe('basic');
  expect(result.rules.length).toBeGreaterThan(0);
  expect(
    result.rules.every((rule: { ignoredEntities: unknown }) =>
      Array.isArray(rule.ignoredEntities)
    )
  ).toBe(true);
  expect(result.preferences.preferences).toContainEqual({
    type: 'appMode',
    config: { value: 'ai' },
  });
  expect(result.report.results[0].report.data[0].originEntityFQN).toBe('1');
  expect(mutations).toEqual([]);
});

test('product ports and chart previews retain their pagination and result containers', async ({
  page,
}) => {
  await installVisualData(page);
  const product = VISUAL_ENTITIES.find(({ type }) => type === 'dataProduct');
  if (!product) throw new Error('A product fixture is required.');
  const result = await page.evaluate(
    async (fqn) => ({
      ports: await (
        await fetch(`/api/v1/dataProducts/name/${fqn}/portsView`)
      ).json(),
      chart: await (
        await fetch(
          '/api/v1/analytics/dataInsights/system/charts/name/total_data_assets/data'
        )
      ).json(),
      online: await (await fetch('/api/v1/users/online')).json(),
    }),
    product.entity.fullyQualifiedName
  );
  expect(result.ports.inputPorts.paging.total).toBe(0);
  expect(result.ports.outputPorts.data).toEqual([]);
  expect(result.chart.results).toHaveLength(7);
  expect(
    result.chart.results.every((point: { count: number }) =>
      Number.isFinite(point.count)
    )
  ).toBe(true);
  expect(Array.isArray(result.online.data)).toBe(true);
});

test('unmodeled catalog reads fail instead of leaking live data', async ({
  page,
}) => {
  await installVisualData(page);
  const response = await page.evaluate(async () => {
    const result = await fetch('/api/v1/a-new-read-endpoint');
    return { status: result.status, body: await result.json() };
  });
  expect(response.status).toBe(503);
  expect(response.body.message).toContain(
    'Missing visual read fixture: a-new-read-endpoint'
  );
});

test('settings reads preserve list contracts and capability POSTs never mutate the server', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    dimensions: await (await fetch('/api/v1/dataQuality/dimensions')).json(),
    intake: await (await fetch('/api/v1/governance/intakeForms')).json(),
    types: await (await fetch('/api/v1/search/entityTypes')).json(),
    capabilities: await (
      await fetch('/api/v1/events/subscriptions/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertType: 'Notification', sources: ['table'] }),
      })
    ).json(),
    ruleWrite: (
      await fetch('/api/v1/system/settings/entityRulesSettings/table', {
        method: 'POST',
        body: '{}',
      })
    ).status,
  }));
  expect(
    result.dimensions.data.map((item: { name: string }) => item.name)
  ).toContain('Completeness');
  expect(result.intake).toEqual({ data: [], paging: { total: 0 } });
  expect(result.types).toContain('table');
  expect(result.capabilities.sources).toContainEqual({
    name: 'table',
    kind: 'entity',
    canJoin: true,
    selected: true,
  });
  expect(result.ruleWrite).toBe(503);
  expect(mutations).toEqual([]);
});

test('service overview and activity reads use their own API contracts', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    overview: await (
      await fetch('/api/v1/services/overview?listEntityType=databaseService')
    ).json(),
    activity: await (await fetch('/api/v1/activity')).json(),
    intake: (
      await fetch('/api/v1/governance/intakeForms/entityType/table')
    ).status,
    fields: await (
      await fetch('/api/v1/metadata/types/fields/workflowTriggerFields')
    ).json(),
  }));
  expect(result.overview.total).toBe(9);
  expect(result.overview.counts.databaseService).toBe(1);
  expect(result.overview.paging.total).toBe(1);
  expect(result.overview.data).toHaveLength(1);
  expect(result.overview.data[0].entityType).toBe('databaseService');
  expect(result.overview.data[0]).not.toHaveProperty('connection');
  expect(result.activity.data[0].eventType).toBe('DescriptionUpdated');
  expect(result.intake).toBe(404);
  expect(result.fields.common.length).toBeGreaterThan(0);
});

test('populated task and activity lists retain identities and status counts', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    tasks: await (
      await fetch('/api/v1/tasks/visible?category=MetadataUpdate')
    ).json(),
    task: await (await fetch('/api/v1/tasks/name/TASK-00041')).json(),
    counts: await (await fetch('/api/v1/tasks/count')).json(),
    activity: await (await fetch('/api/v1/activity')).json(),
  }));
  expect(result.tasks.data).toHaveLength(2);
  expect(result.task.taskId).toBe('TASK-00041');
  expect(result.task.payload.newDescription).toContain('certified finance');
  expect(result.counts.open).toBe(result.counts.total);
  expect(result.counts.total).toBe(4);
  expect(result.activity.data[0].entity.type).toBe('table');
});

test('incident histogram rows stay numeric and distinct from scalar coverage rows', async ({
  page,
}) => {
  await installVisualData(page);
  const report = await page.evaluate(async () =>
    (
      await fetch('/api/v1/dataQuality/testSuites/dataQualityReport/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              key: 'open',
              index: 'testCaseResolutionStatus',
              q: 'New',
              aggregationQuery:
                'aggType=date_histogram:field=timestamp,aggType=cardinality:field=stateId',
            },
            {
              key: 'closed',
              index: 'testCaseResolutionStatus',
              q: 'Resolved',
              aggregationQuery:
                'aggType=date_histogram:field=timestamp,aggType=cardinality:field=stateId',
            },
          ],
        }),
      })
    ).json()
  );
  const open = report.results[0].report.data;
  expect(open).toHaveLength(7);
  expect(
    open.every(
      (row: { timestamp: number; stateId: number }) =>
        Number.isFinite(row.timestamp) && Number.isFinite(row.stateId)
    )
  ).toBe(true);
  expect(open[6].stateId).toBe(1);
  expect(report.results[1].report.data[6].stateId).toBe(0);
});

test('article attachments and memory form values preserve their public response shapes', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    attachments: await (
      await fetch('/api/v1/attachments/fqn/visual_finance_handbook/Inline')
    ).json(),
    memory: await (
      await fetch('/api/v1/contextCenter/memories/name/visual_revenue_policy')
    ).json(),
  }));
  expect(result.attachments).toEqual([]);
  expect(result.memory.memoryType).toBe('Faq');
  expect(result.memory.memoryScope).toBe('EntityScoped');
});

test('live feed sockets cannot subscribe to the shared backend', async ({
  page,
}) => {
  await installVisualData(page);
  // The HTTP primer is already loaded; visual pages install socket routing
  // before navigation, so reload to exercise that same document lifecycle.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const socket = new WebSocket(
          `${location.origin.replace(/^http/, 'ws')}/api/v1/push/feed/`
        );
        socket.onclose = (event) => resolve(event.code);
      })
  );
  expect(upgrades).toBe(0);
});
