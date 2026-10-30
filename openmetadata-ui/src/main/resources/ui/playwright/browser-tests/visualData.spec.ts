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
import {
  installVisualBootstrap,
  installVisualData,
  VISUAL_ENTITIES,
} from '../utils/visualData';
import { expectVisualScreenshot } from '../utils/visualRegression';

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

test('home customization and assigned work use public list contracts', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    tasks: await (
      await fetch('/api/v1/tasks/assigned?statusGroup=Open')
    ).json(),
    widgets: await (
      await fetch('/api/v1/docStore?fqnPrefix=KnowledgePanel')
    ).json(),
    persona: (
      await fetch('/api/v1/docStore/name/persona.VisualAnalystPersona')
    ).status,
    kpis: await (await fetch('/api/v1/kpi')).json(),
    progress: await (
      await fetch('/api/v1/kpi/visual_description_coverage/kpiResult')
    ).json(),
  }));
  expect(result.tasks.data).toHaveLength(4);
  expect(result.tasks.paging.total).toBe(4);
  expect(
    result.widgets.data.some(
      (widget: { fullyQualifiedName: string }) =>
        widget.fullyQualifiedName === 'KnowledgePanel.MyTask'
    )
  ).toBe(true);
  // A persona without a saved layout must take the default-layout branch.
  expect(result.persona).toBe(404);
  expect(result.kpis.data).toHaveLength(3);
  expect(result.progress.results.length).toBeGreaterThan(1);
  expect(
    result.progress.results.every(
      (row: { count: number; day: number }) =>
        Number.isFinite(row.count) && Number.isFinite(row.day)
    )
  ).toBe(true);
});

test('incident pickers use test-case identities without adding tests to discovery assets', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    cases: await (
      await fetch('/api/v1/search/query?index=testCase&q=*')
    ).json(),
    assets: await (
      await fetch('/api/v1/search/query?index=dataAsset&q=*')
    ).json(),
  }));
  expect(result.cases.hits.hits).toHaveLength(2);
  expect(
    result.cases.hits.hits.every(
      (hit: { _source: { entityType: string } }) =>
        hit._source.entityType === 'testCase'
    )
  ).toBe(true);
  expect(
    result.assets.hits.hits.some(
      (hit: { _source: { entityType: string } }) =>
        hit._source.entityType === 'testCase'
    )
  ).toBe(false);
});

test('typed custom-property metadata and table values share the registered field identities', async ({
  page,
}) => {
  await installVisualData(page, 'custom-properties');
  const result = await page.evaluate(async () => ({
    fields: await (await fetch('/api/v1/metadata/types?category=field')).json(),
    type: await (
      await fetch('/api/v1/metadata/types/name/table?fields=customProperties')
    ).json(),
    table: await (
      await fetch(
        '/api/v1/tables/name/visual_warehouse.finance.public.orders?fields=extension'
      )
    ).json(),
  }));
  expect(result.fields.data).toHaveLength(17);
  expect(result.type.customProperties).toHaveLength(18);
  const fieldIds = new Set(
    result.fields.data.map((field: { id: string }) => field.id)
  );
  expect(
    result.type.customProperties.every(
      (property: { name: string; propertyType: { id: string } }) =>
        fieldIds.has(property.propertyType.id) &&
        property.name in result.table.extension
    )
  ).toBe(true);
  expect(result.table.extension.visual_date_cp).toBe('2026-01-15');
  expect(result.table.extension.visual_table_cp.rows).toHaveLength(2);
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

test('table incident badges receive a scalar count rather than test-case status rows', async ({
  page,
}) => {
  await installVisualData(page);
  const reports = await page.evaluate(async () =>
    Promise.all(
      ['New', 'Resolved'].map(async (status) =>
        (
          await fetch(
            `/api/v1/dataQuality/testSuites/dataQualityReport?index=testCaseResolutionStatus&q=${status}&aggregationQuery=aggType=cardinality:field=stateId`
          )
        ).json()
      )
    )
  );
  expect(reports[0].data).toEqual([{ stateId: '1' }]);
  expect(reports[1].data).toEqual([{ stateId: '0' }]);
});

test('workflow history provides schema-shaped finished and running executions', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () =>
    (
      await fetch(
        '/api/v1/governance/workflowInstances?workflowDefinitionName=visual_approval_workflow'
      )
    ).json()
  );
  expect(result.paging.total).toBe(2);
  expect(
    result.data.map((instance: { status: string }) => instance.status)
  ).toEqual(['FINISHED', 'RUNNING']);
  expect(result.data[0].endedAt).toBeGreaterThan(result.data[0].startedAt);
  expect(result.data[1].endedAt).toBeUndefined();
  expect(result.data[0].variables.relatedEntity).toContain(
    'VisualBusinessGlossary.Customer'
  );
});

test('topic schemas and message samples retain their nested API contracts', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => {
    const topic = await (
      await fetch('/api/v1/topics/name/visual_kafka.customer_events')
    ).json();
    const topicSample = await (
      await fetch(`/api/v1/topics/${topic.id}/sampleData`)
    ).json();
    const index = await (
      await fetch('/api/v1/searchIndexes/name/visual_elastic.customers')
    ).json();
    const indexSample = await (
      await fetch(`/api/v1/searchIndexes/${index.id}/sampleData`)
    ).json();
    return { topic, topicSample, indexSample };
  });
  expect(result.topic.messageSchema.schemaFields.length).toBeGreaterThan(1);
  expect(result.topic.messageSchema.schemaType).toBe('Avro');
  expect(result.topic.topicConfig['cleanup.policy']).toBe('delete');
  expect(result.topicSample.sampleData.messages).toHaveLength(2);
  expect(result.indexSample.sampleData.messages).toHaveLength(2);
});

test('glossary workflow stages belong to their selected execution', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => {
    const { data: instances } = await (
      await fetch(
        '/api/v1/governance/workflowInstances?workflowDefinitionName=visual_approval_workflow'
      )
    ).json();
    const instance = instances.find(
      (item: { status: string }) => item.status === 'RUNNING'
    );
    const response = await fetch(
      `/api/v1/governance/workflowInstanceStates/visual_approval_workflow/${instance.id}`
    );
    return { status: response.status, instance, stages: await response.json() };
  });
  expect(result.status).toBe(200);
  expect(result.stages.data).not.toHaveLength(0);
  expect(
    result.stages.data.every(
      (stage: { workflowInstanceId: string }) =>
        stage.workflowInstanceId === result.instance.id
    )
  ).toBe(true);
  expect(
    result.stages.data.map((stage: { status: string }) => stage.status)
  ).toContain('RUNNING');
});

for (const query of [
  'workflowDefinitionName=visual_periodic_workflow',
  'entityLink=' +
    encodeURIComponent('<#E::glossaryTerm::AnotherGlossary.Term>'),
]) {
  test(`workflow execution fixtures honor their scope: ${query}`, async ({
    page,
  }) => {
    await installVisualData(page);
    const result = await page.evaluate(
      async (filter) =>
        (await fetch(`/api/v1/governance/workflowInstances?${filter}`)).json(),
      query
    );
    expect(result).toEqual({ data: [], paging: { total: 0 } });
  });
}

test('notification lists load the built-in feed alert without duplicating it in user alerts', async ({
  page,
}) => {
  await installVisualData(page);
  const [notifications, activityFeed] = await page.evaluate(async () =>
    Promise.all([
      fetch('/api/v1/events/subscriptions?alertType=Notification').then(
        (response) => response.json()
      ),
      fetch(
        '/api/v1/events/subscriptions/name/ActivityFeedAlert?include=all'
      ).then((response) => response.json()),
    ])
  );
  expect(
    notifications.data.map((alert: { name: string }) => alert.name)
  ).toEqual(['visual_metadata_alert']);
  expect(activityFeed).toMatchObject({
    name: 'ActivityFeedAlert',
    provider: 'system',
    alertType: 'ActivityFeed',
  });
});

for (const state of ['populated', 'error'] as const) {
  for (const path of [
    'a-new-read-endpoint',
    'tables/not-a-fixture-id',
    'tables/hierarchy',
    'tables/name/visual_warehouse.finance.public.orders/versions/not-a-version',
    'permissions/table/name/orders/unmodeledChild',
    'users/admin/preferences/unmodeledChild',
    'personas/a6fde953-d444-53db-a80c-e62a9b95e2b4/aiContext/unmodeledChild',
    'tables/name/visual_warehouse.finance.public.orders/unmodeledChild',
    'users/name/visual_steward/unmodeledChild',
    'users/name/visual_steward/columns',
    'metrics/a2db4c89-cc42-5fad-b381-2dfa9180e5c0/sampleData',
    'documents/name/KnowledgePanel.ActivityFeed',
    'kpis/name/visual_description_coverage',
    'kpi/name/visual_description_coverage/versions',
    'system/settings/unmodeledSetting',
    'system/config/auth/unmodeledChild',
    'metadata/types/name/table/unmodeledChild',
    'metadata/types/name/unknownType/customProperties',
    'dataQuality/testCases/testCaseIncidentStatus/unmodeledChild',
    'kpi/unknownMetric/kpiResult',
    'docStore/name/persona.VisualAnalystPersona/unmodeledChild',
    'lineage/unmodeledRead',
    'activity/unmodeledRead',
    'analytics/dataInsights/system/charts/unmodeledRead',
    'analytics/dataInsights/system/charts/name/unmodeledChart/data',
  ]) {
    test(`unmodeled reads block capture even when their errors are swallowed: ${state} ${path}`, async ({
      page,
    }) => {
      await installVisualData(page, state);
      const status = await page.evaluate(async (endpoint) => {
        // A component may catch a failed read without showing a notification.
        const response = await fetch(`/api/v1/${endpoint}`);
        await response.json();
        return response.status;
      }, path);
      expect(status).toBe(503);
      expect(test.info().annotations).toContainEqual({
        type: 'missing-visual-read-fixture',
        description: `Missing visual read fixture: ${path}`,
      });
      await expect(page.getByText(/^Missing visual read fixture:/)).toHaveCount(
        0
      );
      await expect(
        expectVisualScreenshot(page, 'unmodeled-read-must-not-capture', 'light')
      ).rejects.toThrow(`Missing visual read fixture: ${path}`);
    });
  }
}

test('capabilities and persona context reads return their public shapes', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => {
    const capabilities = await (
      await fetch('/api/v1/system/search/nlq')
    ).json();
    const statuses = await (
      await fetch('/api/v1/personas/aiContext/status')
    ).json();
    const context = await (
      await fetch(`/api/v1/personas/${statuses.data[0].personaId}/aiContext`)
    ).json();
    return { capabilities, statuses, context };
  });
  expect(result.capabilities).toBe(false);
  expect(result.statuses.data[0]).toMatchObject({
    cacheState: 'STALE',
    entitiesIncluded: 0,
    tokensEst: 0,
  });
  expect(result.context).toMatchObject({ enabled: false, rules: [] });
  expect(result.context).not.toHaveProperty('data');
});

test('latest KPI and incident search reads retain numeric results and populated identities', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    kpi: await (
      await fetch('/api/v1/kpi/visual_completed_target/latestKpiResult')
    ).json(),
    incidents: await (
      await fetch(
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
      )
    ).json(),
  }));
  expect(Number.isFinite(Number(result.kpi.targetResult[0].value))).toBe(true);
  expect(result.kpi.targetResult[0].targetMet).toBe(true);
  expect(result.kpi.timestamp).toBeGreaterThan(0);
  expect(result.incidents.data).not.toHaveLength(0);
  expect(result.incidents.data[0].id).toBeTruthy();
});

test('repeated missing reads keep one diagnostic rather than growing test state', async ({
  page,
}) => {
  await installVisualData(page);
  await page.evaluate(async () => {
    for (let attempt = 0; attempt < 32; attempt++) {
      await (await fetch('/api/v1/unmodeled-polling-read')).json();
    }
  });
  expect(
    test
      .info()
      .annotations.filter(({ type }) => type === 'missing-visual-read-fixture')
  ).toHaveLength(1);
});

test('hierarchy, policy and application reads use explicit list contracts', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    domains: await (
      await fetch('/api/v1/domains/hierarchy?limit=1&offset=0')
    ).json(),
    children: await (
      await fetch('/api/v1/domains/hierarchy?directChildrenOf=VisualFinance')
    ).json(),
    permission: await (
      await fetch(
        '/api/v1/permissions/table/name/visual_warehouse.finance.public.orders'
      )
    ).json(),
    pipelines: await (await fetch('/api/v1/pipelines/summary')).json(),
    resources: await (await fetch('/api/v1/policies/resources')).json(),
    history: await (
      await fetch('/api/v1/apps/name/SearchIndexingApplication/status')
    ).json(),
  }));
  expect(result.domains.data[0].fullyQualifiedName).toBe('VisualFinance');
  expect(result.domains.paging.total).toBe(1);
  expect(result.children).toEqual({ data: [], paging: { total: 0 } });
  expect(result.permission.resource).toBe('table');
  expect(result.pipelines.data[0].impactedAssetsCount).toBe(
    result.pipelines.data[0].impactedAssets.length
  );
  expect(
    result.resources.data.find(
      (resource: { name: string }) => resource.name === 'table'
    ).operations
  ).toContain('All');
  expect(result.history).toEqual({ data: [], paging: { total: 0 } });
  expect(
    test
      .info()
      .annotations.filter(({ type }) => type === 'missing-visual-read-fixture')
  ).toHaveLength(0);
});

test('quality summary and configuration reads retain scalar contracts and scope', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    summary: await (
      await fetch('/api/v1/dataQuality/testSuites/executionSummary')
    ).json(),
    otherSuite: await (
      await fetch(
        '/api/v1/dataQuality/testSuites/executionSummary?testSuiteId=another-suite'
      )
    ).json(),
    counts: await (
      await fetch('/api/v1/dataQuality/dimensions/testCaseCounts')
    ).json(),
    security: await (await fetch('/api/v1/system/security/config')).json(),
    login: await (await fetch('/api/v1/system/config/loginConfig')).json(),
    functions: await (await fetch('/api/v1/policies/functions')).json(),
  }));
  expect(result.summary).toMatchObject({
    total: 2,
    success: 1,
    failed: 1,
    aborted: 0,
    queued: 0,
  });
  expect(result.otherSuite.total).toBe(0);
  expect(result.counts.Completeness).toBe(1);
  expect(result.counts.Integrity).toBe(1);
  expect(result.security.authenticationConfiguration.provider).toBe('basic');
  expect(result.security.authorizerConfiguration.adminPrincipals).toContain(
    'admin'
  );
  expect(result.login).not.toHaveProperty('config_value');
  expect(result.functions.data[0].examples).toContain('isOwner()');
});

test('public bootstrap reads cannot fall through to the shared backend', async ({
  page,
}) => {
  await installVisualBootstrap(page, 'classic');
  const status = await page.evaluate(
    async () => (await fetch('/api/v1/unmodeled-public-read')).status
  );
  expect(status).toBe(503);
  await expect(
    expectVisualScreenshot(page, 'public-read-must-not-capture', 'light')
  ).rejects.toThrow('Missing visual read fixture: unmodeled-public-read');
});

test('asset and dimension count maps describe the same fixture catalog', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    domains: await (await fetch('/api/v1/domains/assets/counts')).json(),
    products: await (await fetch('/api/v1/dataProducts/assets/counts')).json(),
    terms: await (
      await fetch(
        '/api/v1/glossaryTerms/assets/counts?parent=VisualBusinessGlossary'
      )
    ).json(),
    definitions: await (
      await fetch('/api/v1/dataQuality/dimensions/testDefinitionCounts')
    ).json(),
    cases: await (
      await fetch('/api/v1/dataQuality/dimensions/testCaseCounts')
    ).json(),
  }));
  expect(result.domains.VisualFinance).toBeGreaterThan(0);
  expect(Number.isFinite(result.products.visual_revenue_product)).toBe(true);
  expect(result.terms['VisualBusinessGlossary.Customer']).toBe(0);
  expect(result.definitions.Uniqueness).toBe(1);
  expect(result.cases.Uniqueness).toBe(0);
});

test('profile and history endpoints preserve their document and paged-list shapes', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => ({
    profile: await (
      await fetch(
        '/api/v1/tables/visual_warehouse.finance.public.orders/tableProfile/latest'
      )
    ).json(),
    history: await (
      await fetch(
        '/api/v1/tables/visual_warehouse.finance.public.orders/tableProfile'
      )
    ).json(),
    pipeline: await (
      await fetch('/api/v1/pipelines/visual_airflow.customer_sync/status')
    ).json(),
    children: await (
      await fetch('/api/v1/containers/name/visual_s3.analytics/children')
    ).json(),
    ancestors: await (
      await fetch('/api/v1/containers/name/visual_s3.analytics/ancestors')
    ).json(),
    assets: await (
      await fetch('/api/v1/metrics/a2db4c89-cc42-5fad-b381-2dfa9180e5c0/assets')
    ).json(),
    kpiHistory: await (
      await fetch('/api/v1/kpi/visual_completed_target/kpiResult')
    ).json(),
    latestKpi: await (
      await fetch('/api/v1/kpi/visual_completed_target/latestKpiResult')
    ).json(),
  }));
  expect(result.profile.columns).toHaveLength(3);
  expect(result.profile).not.toHaveProperty('paging');
  expect(result.history).toEqual({ data: [], paging: { total: 0 } });
  expect(result.pipeline.data[0].executionStatus).toBe('Successful');
  expect(result.pipeline.data[0].taskStatus).toHaveLength(2);
  expect(result.children).toEqual({ data: [], paging: { total: 0 } });
  expect(result.ancestors).toEqual([]);
  expect(result.assets).toEqual({ data: [], paging: { total: 0 } });
  expect(result.kpiHistory.results.at(-1).count).toBe(
    Number(result.latestKpi.targetResult[0].value)
  );
});

test('KPI detail uses its REST namespace rather than the seed-data alias', async ({
  page,
}) => {
  await installVisualData(page);
  const result = await page.evaluate(async () => {
    const response = await fetch(
      '/api/v1/kpi/name/visual_description_coverage'
    );
    return { status: response.status, body: await response.json() };
  });
  expect(result.status).toBe(200);
  expect(result.body.fullyQualifiedName).toBe('visual_description_coverage');
});

test('dashboard data models retain their own paginated column endpoint', async ({
  page,
}) => {
  await installVisualData(page);
  const response = await page.evaluate(async () =>
    (
      await fetch(
        '/api/v1/dashboard/datamodels/name/visual_looker.customer_model/columns'
      )
    ).json()
  );
  expect(response.data).toHaveLength(5);
  expect(response.paging.total).toBe(5);
  expect(
    response.data.every((column: { name: string }) => Boolean(column.name))
  ).toBe(true);
});
