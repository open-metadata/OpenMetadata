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
import { expect, Locator, Page, Route, test } from '@playwright/test';
import { installVisualData } from '../../utils/visualData';
import { expectVisualMenuScreenshots } from '../../utils/visualMenus';
import {
  expectVisualScreenshot,
  FIXED_DATE,
  gotoForScreenshot,
  prepareVisualTheme,
  VisualTheme,
  VISUAL_THEMES,
  withFullVisualTarget,
} from '../../utils/visualRegression';

const METRIC_ID = '11111111-1111-4111-8111-111111111111';
const METRIC_FQN = 'visual_gross_margin';
const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const TABLE_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const FIXED_TIMESTAMP = FIXED_DATE.getTime();

const permissions = {
  permissions: [
    'Create',
    'Delete',
    'EditAll',
    'EditCustomFields',
    'EditDataProfile',
    'EditDescription',
    'EditDisplayName',
    'EditEntityRelationship',
    'EditLineage',
    'EditOwners',
    'EditQueries',
    'EditReviewers',
    'EditSampleData',
    'EditStatus',
    'EditTags',
    'ViewAll',
    'ViewBasic',
    'ViewDataProfile',
    'ViewQueries',
    'ViewSampleData',
    'ViewTests',
    'ViewUsage',
  ].map((operation) => ({ access: 'allow', operation })),
  resource: 'metric',
};

const owner = {
  displayName: 'Finance Analytics',
  fullyQualifiedName: 'finance_analytics',
  id: '55555555-5555-4555-8555-555555555555',
  name: 'finance_analytics',
  type: 'team',
};

const reviewer = {
  displayName: 'Platform Admin',
  fullyQualifiedName: 'admin',
  id: ADMIN_ID,
  name: 'admin',
  type: 'user',
};

const domain = {
  displayName: 'Finance',
  fullyQualifiedName: 'Finance',
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Finance',
  type: 'domain',
};

const metric = {
  childrenCount: 2,
  description:
    'Gross profit as a percentage of recognized revenue for the reporting period.',
  displayName: 'Gross Margin',
  domains: [domain],
  entityStatus: 'In Review',
  experts: [reviewer],
  extension: {
    businessCriticality: 'Board reporting',
    targetRange: '70–90%',
  },
  fullyQualifiedName: METRIC_FQN,
  granularity: 'DAY',
  id: METRIC_ID,
  metricExpression: {
    code: '(SUM(revenue) - SUM(cost_of_goods)) / SUM(revenue) * 100',
    language: 'SQL',
  },
  metricGroup: {
    displayName: 'Profitability',
    fullyQualifiedName: 'profitability',
    id: GROUP_ID,
    name: 'profitability',
    type: 'metricGroup',
  },
  metricType: 'PERCENTAGE',
  name: METRIC_FQN,
  owners: [owner],
  relatedMetrics: [
    {
      displayName: 'Net Revenue',
      fullyQualifiedName: 'net_revenue',
      id: '77777777-7777-4777-8777-777777777777',
      name: 'net_revenue',
      type: 'metric',
    },
  ],
  reviewers: [reviewer],
  tags: [
    {
      displayName: 'Tier 1',
      labelType: 'Manual',
      source: 'Classification',
      state: 'Confirmed',
      tagFQN: 'Tier.Tier1',
    },
    {
      displayName: 'Financial Reporting',
      labelType: 'Manual',
      source: 'Glossary',
      state: 'Confirmed',
      tagFQN: 'Financial Reporting',
    },
  ],
  unitOfMeasurement: 'PERCENTAGE',
  updatedAt: FIXED_TIMESTAMP - 3_600_000,
  updatedBy: 'finance.steward',
  version: 1.4,
};

const groupedMetric = {
  ...metric,
  childrenCount: 1,
  description: 'Primary profitability KPI reviewed by the finance team.',
  entityStatus: 'Approved',
  reviewers: [],
};

const standaloneMetric = {
  childrenCount: 0,
  description: 'Daily active customers with a settled transaction.',
  displayName: 'Active Customers',
  entityStatus: 'Approved',
  fullyQualifiedName: 'active_customers',
  granularity: 'DAY',
  id: '88888888-8888-4888-8888-888888888888',
  metricType: 'COUNT',
  name: 'active_customers',
  owners: [owner],
  unitOfMeasurement: 'COUNT',
  updatedAt: FIXED_TIMESTAMP - 7_200_000,
};

const table = {
  columns: [
    {
      dataType: 'NUMBER',
      displayName: 'Revenue',
      fullyQualifiedName: 'warehouse.finance.fact_orders.revenue',
      name: 'revenue',
    },
    {
      dataType: 'NUMBER',
      displayName: 'Cost of goods',
      fullyQualifiedName: 'warehouse.finance.fact_orders.cost_of_goods',
      name: 'cost_of_goods',
    },
  ],
  database: {
    displayName: 'Analytics Warehouse',
    id: 'database-id',
    name: 'analytics_warehouse',
    type: 'database',
  },
  databaseSchema: {
    displayName: 'Finance',
    id: 'schema-id',
    name: 'finance',
    type: 'databaseSchema',
  },
  description: 'Certified order facts used for finance reporting.',
  displayName: 'Finance Orders',
  domains: [domain],
  fullyQualifiedName: 'warehouse.finance.fact_orders',
  id: TABLE_ID,
  name: 'fact_orders',
  owners: [owner],
  service: {
    displayName: 'Warehouse',
    id: 'service-id',
    name: 'warehouse',
    type: 'databaseService',
  },
  tags: metric.tags,
  tier: {
    displayName: 'Tier 1',
    tagFQN: 'Tier.Tier1',
  },
  type: 'table',
  usageSummary: { dailyStats: { count: 1284 } },
};

const assetRelation = {
  affectsHealth: true,
  asset: {
    displayName: table.displayName,
    fullyQualifiedName: table.fullyQualifiedName,
    id: TABLE_ID,
    name: table.name,
    type: 'table',
  },
  direction: 'upstream',
};

const observability = {
  assets: [
    {
      asset: assetRelation.asset,
      failed: 1,
      health: 'AtRisk',
      latestRunTime: FIXED_TIMESTAMP - 1_800_000,
      passed: 5,
      score: 83,
      total: 6,
    },
  ],
  dimensions: [
    {
      dimension: 'Completeness',
      failed: 0,
      passed: 3,
      score: 100,
      total: 3,
    },
    {
      dimension: 'Accuracy',
      failed: 1,
      passed: 2,
      score: 67,
      total: 3,
    },
  ],
  evaluatedAssetCount: 1,
  evaluatedAt: FIXED_TIMESTAMP - 900_000,
  health: 'AtRisk',
  incidents: [
    {
      asset: assetRelation.asset,
      id: 'incident-1',
      severity: 'Major',
      status: 'Open',
      testCase: {
        displayName: 'Revenue within expected range',
        id: 'test-accuracy',
        name: 'revenue_expected_range',
        type: 'testCase',
      },
      timestamp: FIXED_TIMESTAMP - 1_800_000,
    },
  ],
  latestRunTime: FIXED_TIMESTAMP - 1_800_000,
  linkedAssets: [assetRelation],
  metric: {
    displayName: metric.displayName,
    fullyQualifiedName: METRIC_FQN,
    id: METRIC_ID,
    name: METRIC_FQN,
    type: 'metric',
  },
  partial: false,
  reasonCode: 'AtRisk',
  score: 83,
  sourceCoverage: {
    coveragePercent: 100,
    partial: false,
    restrictedTables: 0,
    testedTables: 1,
    upstreamTables: 1,
    visibleTables: 1,
  },
  statusCounts: {
    aborted: 0,
    failed: 1,
    missing: 0,
    passed: 5,
    queued: 0,
    terminal: 6,
  },
  tests: [
    {
      asset: assetRelation.asset,
      dimension: 'Completeness',
      status: 'Success',
      testCase: {
        displayName: 'Revenue is complete',
        id: 'test-completeness',
        name: 'revenue_not_null',
        type: 'testCase',
      },
      timestamp: FIXED_TIMESTAMP - 1_800_000,
    },
    {
      asset: assetRelation.asset,
      dimension: 'Accuracy',
      status: 'Failed',
      testCase: {
        displayName: 'Revenue within expected range',
        id: 'test-accuracy',
        name: 'revenue_expected_range',
        type: 'testCase',
      },
      timestamp: FIXED_TIMESTAMP - 1_800_000,
    },
  ],
  upstreamAssetCount: 1,
};

const approvalTask = {
  about: `<#E::metric::${METRIC_FQN}>`,
  assignees: [reviewer],
  availableTransitions: [
    {
      displayName: 'Approve',
      id: 'approve-transition',
      name: 'approve',
      resolutionType: 'Approved',
    },
    {
      displayName: 'Reject',
      id: 'reject-transition',
      name: 'reject',
      resolutionType: 'Rejected',
    },
  ],
  category: 'Approval',
  createdAt: FIXED_TIMESTAMP - 7_200_000,
  createdBy: {
    displayName: 'Finance Steward',
    id: 'steward-id',
    name: 'finance.steward',
    type: 'user',
  },
  displayName: 'Review Gross Margin',
  id: 'approval-task-1',
  name: 'review_gross_margin',
  priority: 'High',
  reviewers: [reviewer],
  status: 'Open',
  taskId: 41,
  type: 'RequestApproval',
  updatedAt: FIXED_TIMESTAMP - 3_600_000,
};

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  });

const setupMetricRoutes = async (page: Page) => {
  const storageState = (await page
    .context()
    .storageState({ indexedDB: true })) as unknown as {
    origins: Array<{
      indexedDB?: Array<{
        stores: Array<{
          records: Array<{ key: string; value: string }>;
        }>;
      }>;
      localStorage: Array<{ name: string; value: string }>;
    }>;
  };
  const authOrigin = storageState.origins.find(
    ({ indexedDB }) => indexedDB?.length
  );
  const authenticatedStorage = (authOrigin?.localStorage ?? []).filter(
    ({ name }) => ['loggedInUsers', 'omAppModeHint'].includes(name)
  );
  const appState = authOrigin?.indexedDB
    ?.flatMap(({ stores }) => stores)
    .flatMap(({ records }) => records)
    .find(({ key }) => key === 'app_state')?.value;

  expect(
    appState,
    'admin storage state must contain the auth token'
  ).toBeTruthy();

  // The isolated Vite port has a different origin from the persisted admin session.
  await page.route('**/__metric-visual-auth', (route) =>
    route.fulfill({ body: '<!doctype html><title>Metric visual auth</title>' })
  );
  await page.goto('/__metric-visual-auth');
  await page.evaluate(
    async ({ entries, tokenState }) => {
      entries.forEach(({ name, value }) => localStorage.setItem(name, value));
      localStorage.removeItem('user-preferences-store');
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('AppDataStore', 1);

        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('keyValueStore')) {
            request.result.createObjectStore('keyValueStore');
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            'keyValueStore',
            'readwrite'
          );

          transaction.objectStore('keyValueStore').put(tokenState, 'app_state');
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      });
    },
    { entries: authenticatedStorage, tokenState: appState }
  );
  await page.unroute('**/__metric-visual-auth');
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    // Read fixtures must not turn edit requests into successful no-ops.
    if (request.method() !== 'GET') return route.fallback();

    if (path === '/api/v1/permissions/metric') {
      return fulfillJson(route, permissions);
    }
    if (path === `/api/v1/permissions/metric/name/${METRIC_FQN}`) {
      return fulfillJson(route, permissions);
    }
    if (path === '/api/v1/metrics/hierarchy') {
      return fulfillJson(route, {
        data: [
          {
            group: {
              description: 'Board-level profitability and margin metrics.',
              displayName: 'Profitability',
              entityStatus: 'Approved',
              fullyQualifiedName: 'profitability',
              id: GROUP_ID,
              metricCount: 1,
              name: 'profitability',
              owners: [owner],
              updatedAt: FIXED_TIMESTAMP - 3_600_000,
            },
            kind: 'metricGroup',
          },
          { kind: 'metric', metric: standaloneMetric },
        ],
        paging: { limit: 20, offset: 0, total: 2 },
      });
    }
    if (path === `/api/v1/metricGroups/${GROUP_ID}/metrics`) {
      return fulfillJson(route, {
        data: [groupedMetric],
        paging: { limit: 25, offset: 0, total: 1 },
      });
    }
    if (path === `/api/v1/metrics/name/${METRIC_FQN}`) {
      return fulfillJson(route, metric);
    }
    if (path === `/api/v1/metrics/${METRIC_ID}/hierarchy`) {
      return fulfillJson(route, {
        ancestors: [
          {
            description: 'All margin measures.',
            displayName: 'Margin',
            entityStatus: 'Approved',
            fullyQualifiedName: 'margin',
            id: 'ancestor-metric',
            name: 'margin',
          },
        ],
        children: [
          {
            displayName: 'Gross Margin — Americas',
            entityStatus: 'Approved',
            fullyQualifiedName: 'gross_margin_americas',
            id: 'child-americas',
            name: 'gross_margin_americas',
            owners: [owner],
          },
          {
            displayName: 'Gross Margin — EMEA',
            entityStatus: 'Draft',
            fullyQualifiedName: 'gross_margin_emea',
            id: 'child-emea',
            name: 'gross_margin_emea',
            owners: [owner],
          },
        ],
        childrenPaging: { limit: 25, offset: 0, total: 2 },
        current: metric,
        group: {
          description: 'Board-level profitability and margin metrics.',
          displayName: 'Profitability',
          fullyQualifiedName: 'profitability',
          id: GROUP_ID,
          metricCount: 4,
          name: 'profitability',
        },
        siblingPaging: { limit: 25, offset: 0, total: 2 },
        siblings: [
          metric,
          {
            displayName: 'Contribution Margin',
            entityStatus: 'Approved',
            fullyQualifiedName: 'contribution_margin',
            id: 'sibling-metric',
            name: 'contribution_margin',
            owners: [owner],
          },
        ],
      });
    }
    if (path === `/api/v1/metrics/${METRIC_ID}/assets`) {
      return fulfillJson(route, {
        data: [assetRelation],
        paging: { limit: 10, offset: 0, total: 1 },
      });
    }
    if (/^\/api\/v1\/metrics\/[^/]+\/observability$/.test(path)) {
      return fulfillJson(route, observability);
    }
    if (path === `/api/v1/tables/name/${table.fullyQualifiedName}`) {
      return fulfillJson(route, table);
    }
    if (path === '/api/v1/lineage/getLineage') {
      return fulfillJson(route, {
        downstreamEdges: [],
        entity: { id: METRIC_ID, type: 'metric' },
        nodes: [],
        upstreamEdges: [
          {
            fromEntity: TABLE_ID,
            lineageDetails: {
              columnsLineage: [
                {
                  fromColumns: [
                    `${table.fullyQualifiedName}.revenue`,
                    `${table.fullyQualifiedName}.cost_of_goods`,
                  ],
                  toColumn: `${METRIC_FQN}.gross_margin`,
                },
              ],
            },
            toEntity: METRIC_ID,
          },
        ],
      });
    }
    if (path === '/api/v1/feed/count') {
      return fulfillJson(route, {
        data: [
          {
            conversationCount: 0,
            count: 0,
            entityLink: `<#E::metric::${METRIC_FQN}>`,
            mentionCount: 0,
          },
        ],
      });
    }
    if (path === '/api/v1/feed') {
      return fulfillJson(route, { data: [], paging: { total: 0 } });
    }
    if (path === `/api/v1/activity/entity/metric/name/${METRIC_FQN}`) {
      return fulfillJson(route, { data: [], paging: { total: 0 } });
    }
    if (path === '/api/v1/tasks/count') {
      return fulfillJson(route, { completed: 2, open: 1, total: 3 });
    }
    if (path === '/api/v1/tasks') {
      const isApproval = url.searchParams.get('type') === 'RequestApproval';

      return fulfillJson(route, {
        data: isApproval ? [approvalTask] : [],
        paging: { limit: 100, total: isApproval ? 1 : 0 },
      });
    }
    if (path === '/api/v1/governance/workflowInstances') {
      return fulfillJson(route, { data: [], paging: { limit: 100, total: 0 } });
    }
    if (path === '/api/v1/users/name/admin') {
      return fulfillJson(route, {
        displayName: 'Platform Admin',
        email: 'admin@open-metadata.org',
        fullyQualifiedName: 'admin',
        id: ADMIN_ID,
        isAdmin: true,
        name: 'admin',
        teams: [],
      });
    }

    return route.fallback();
  });
};

const expectMetricScreenshot = async (
  page: Page,
  name: string,
  viewport: 'desktop' | 'narrow',
  theme: VisualTheme
) => expectVisualScreenshot(page, `metric-${name}-${viewport}`, theme);

const captureMetricList = async (
  page: Page,
  viewport: 'desktop' | 'narrow',
  theme: VisualTheme
) => {
  // Each card's health pill lazy-loads behind an IntersectionObserver and renders a Skeleton
  // until its slot intersects. gotoForScreenshot's skeleton guard runs while the sidebar is
  // still expanded, and at 390px that leaves the cards far enough below the fold that the
  // observer never fires, so the pills stay skeletons and the guard times out. Removing the
  // observer takes MetricListHealth's own documented fallback — it loads eagerly when the API
  // is absent — which is the resolved state both committed baselines were captured in.
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'IntersectionObserver');
  });
  await installVisualData(page);
  await setupMetricRoutes(page);

  await gotoForScreenshot(page, '/metrics');
  await expect(page.getByTestId('metric-list-page')).toBeVisible();
  if (viewport === 'narrow') {
    // The AI shell collapses its main rail at this width, while the route's
    // secondary panel still needs closing to leave room for the metric cards.
    const sidebar = page.getByRole('complementary');
    await sidebar
      .getByRole('button', { name: 'Collapse', exact: true })
      .click();
    await expect(
      sidebar.getByRole('button', { name: 'Collapse', exact: true })
    ).toHaveCount(0);
  }
  await page.getByRole('radio', { name: 'Card' }).click();
  const metricCardView = page.getByTestId('metric-card-view');

  await expect(metricCardView).toBeVisible();
  await expect(
    metricCardView.getByText('Gross Margin', { exact: true })
  ).toBeVisible();
  await expectMetricScreenshot(page, 'list', viewport, theme);
};

for (const theme of VISUAL_THEMES) {
  for (const viewport of ['desktop', 'narrow'] as const) {
    test(`Metric list ${viewport} ${theme}`, async ({ page }) => {
      await page.setViewportSize({
        height: 900,
        width: viewport === 'narrow' ? 390 : 1440,
      });
      await prepareVisualTheme(page, theme);
      await captureMetricList(page, viewport, theme);
    });
  }
}

const METRIC_LIST_SCENES = [
  'table',
  'collapsed-group',
  'status-menu',
  'actions-menu',
  'columns-menu',
  'selected',
  'delete-confirmation',
  'empty',
  'no-results',
  'load-error',
] as const;
const METRIC_CREATE_MENUS: Record<string, string> = {
  'create-type-menu': 'metric-type-select',
  'create-granularity-menu': 'granularity-select',
  'create-unit-menu': 'unit-of-measurement-select',
  'create-language-menu': 'language-select',
};
const METRIC_CREATE_PICKERS: Record<string, string> = {
  'create-parent-picker': 'Parent Metric',
  'create-owner-picker': 'Owners',
  'create-reviewer-picker': 'Reviewers',
  'create-domain-picker': 'Domains',
  'create-related-picker': 'Related Metrics',
};
const METRIC_DEFINITION_MENUS: Record<string, string> = {
  'definition-type-menu': 'metric-definition-type-select',
  'definition-granularity-menu': 'metric-definition-granularity-select',
  'definition-unit-menu': 'metric-definition-unit-select',
  'definition-language-menu': 'metric-definition-language-select',
};

for (const scene of [
  ...METRIC_LIST_SCENES,
  ...Object.keys(METRIC_CREATE_MENUS),
  ...Object.keys(METRIC_CREATE_PICKERS),
  'create-custom-unit',
  'create-validation',
  'detail',
  'assets',
  'asset-picker',
  'hierarchy',
  'definition',
  'definition-edit',
  ...Object.keys(METRIC_DEFINITION_MENUS),
  'definition-custom-unit',
  'definition-validation',
  'definition-save-error',
  'related-metrics-edit',
  'child-metric',
]) {
  for (const theme of VISUAL_THEMES) {
    test(`Metric interaction ${scene} ${theme}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await prepareVisualTheme(page, theme);
      await installVisualData(page);
      await setupMetricRoutes(page);
      // Leaf overrides must leave unmodeled child endpoints to the strict router.
      await page.route(
        (url) => url.pathname === '/api/v1/search/query',
        (route) => {
          if (!route.request().url().includes(TABLE_ID))
            return route.fallback();
          return route.fulfill({
            json: {
              hits: {
                hits: [
                  {
                    _id: TABLE_ID,
                    _index: 'table_search_index',
                    _source: { ...table, entityType: 'table' },
                  },
                ],
                total: { value: 1, relation: 'eq' },
              },
              aggregations: {},
              took: 1,
            },
          });
        }
      );
      const isList = (METRIC_LIST_SCENES as readonly string[]).includes(scene);
      const isCreate = scene.startsWith('create-');
      const detail = !isList && !isCreate;
      const id = `metric-state-${scene}`;
      const failure = 'Unable to load metrics in the visual catalog.';
      if (['empty', 'no-results', 'load-error'].includes(scene)) {
        await page.route(
          (url) => url.pathname === '/api/v1/metrics/hierarchy',
          (route) => {
            if (
              scene === 'no-results' &&
              !new URL(route.request().url()).searchParams.get('q')
            )
              return route.fallback();
            return route.fulfill(
              scene === 'load-error'
                ? { status: 503, json: { message: failure } }
                : {
                    json: {
                      data: [],
                      paging: { limit: 20, offset: 0, total: 0 },
                    },
                  }
            );
          }
        );
      }
      await gotoForScreenshot(
        page,
        detail ? `/metric/${METRIC_FQN}` : '/metrics',
        {
          readyTestId: detail
            ? 'entity-header-display-name'
            : 'metric-list-page',
        }
      );
      let target: Locator | undefined;
      let captureFrame = false;
      let captured = false;
      let allowErrorFeedback = false;
      const captureMenu = async () => {
        const menu = page.getByRole('listbox');
        const popup = page.locator('[data-placement]').filter({ has: menu });
        await expectVisualMenuScreenshots(page, id, theme, menu, popup);
        captured = true;
      };

      if (isList) {
        if (scene === 'load-error') {
          await expect(page.getByTestId('metric-list-error')).toContainText(
            failure
          );
          await expect(page.getByRole('alertdialog')).toContainText(failure);
          allowErrorFeedback = true;
        } else if (scene === 'empty') {
          await expect(
            page.getByRole('button', { name: 'New Metric', exact: true })
          ).toBeVisible();
        } else {
          await page.getByTestId('metric-table-view-button').click();
          const table = page.getByTestId('metric-list-table');
          await expect(
            table.getByRole('rowheader', { name: /Gross Margin/ })
          ).toBeVisible();
          if (scene === 'no-results') {
            await page
              .getByRole('textbox', { name: 'Search Metrics', exact: true })
              .fill('zz_no_such_metric');
            await expect(
              page
                .getByTestId('metric-list-page')
                .locator('[aria-live="polite"]')
            ).toHaveText('0 Results');
            await expect(
              table.getByRole('rowheader', { name: /Gross Margin/ })
            ).toHaveCount(0);
            await expect(
              table.getByText('No matching results', { exact: true })
            ).toBeVisible();
          }
          if (scene === 'collapsed-group') {
            const group = page.getByTestId('metric-group-profitability');
            await group.click();
            await expect(group).toHaveAttribute('aria-expanded', 'false');
            await expect(
              table.getByRole('rowheader', { name: /Gross Margin/ })
            ).toHaveCount(0);
          }
          if (scene === 'status-menu') {
            await page
              .getByRole('button', { name: 'Status', exact: true })
              .click();
            await expect(page.getByRole('menu')).toBeVisible();
          }
          if (scene === 'actions-menu') {
            await page.getByTestId('metric-actions').click();
            await expect(page.getByRole('menu')).toBeVisible();
          }
          if (scene === 'columns-menu') {
            const trigger = page.getByRole('button', {
              name: 'Customize',
              exact: true,
            });
            await trigger.click();
            await expect(trigger).toHaveAttribute('aria-expanded', 'true');
          }
          if (['selected', 'delete-confirmation'].includes(scene)) {
            // Selection belongs to the grid row's keyboard handler.
            const row = table.getByRole('row').filter({
              has: page.getByRole('rowheader', { name: /Gross Margin/ }),
            });
            await row.press('Space');
            await expect(row.getByRole('checkbox')).toBeChecked();
            await expect(
              page.getByTestId('clear-metric-selection')
            ).toBeVisible();
            if (scene === 'delete-confirmation') {
              await page.getByTestId('bulk-delete-metric').click();
              await expect(
                page.getByRole('dialog', { name: 'Delete Metrics' })
              ).toBeVisible();
            }
          }
        }
      } else if (isCreate || scene === 'child-metric') {
        await page
          .getByTestId(isCreate ? 'create-metric' : 'add-child-metric')
          .click();
        const form = page.getByTestId('add-metric-container');
        await expect(form.getByTestId('metric-code')).toBeVisible();
        target = form;
        captureFrame = true;
        if (scene === 'child-metric')
          await expect(
            page.getByTestId('parent-metric-inherited')
          ).toContainText(METRIC_FQN);
        await withFullVisualTarget(page, form, async () => {
          if (METRIC_CREATE_MENUS[scene]) {
            await form
              .getByTestId(METRIC_CREATE_MENUS[scene])
              .getByRole('button')
              .click();
            await captureMenu();
          }
          if (METRIC_CREATE_PICKERS[scene]) {
            await form
              .getByRole('combobox', {
                name: METRIC_CREATE_PICKERS[scene],
                exact: true,
              })
              .click();
            await captureMenu();
          }
          if (scene === 'create-custom-unit') {
            await form
              .getByTestId('unit-of-measurement-select')
              .getByRole('button')
              .click();
            await page
              .getByRole('option', { name: 'Other', exact: true })
              .click();
            await expect(form.getByTestId('custom-unit')).toBeVisible();
          }
          if (scene === 'create-validation') {
            await page.getByTestId('create-button').click();
            await expect(form).toContainText('Name is required');
            await expect(form).toContainText('Code is required');
          }
        });
      } else {
        await expect(
          page.getByTestId('entity-header-display-name')
        ).toContainText('Gross Margin');
        await expect(page.getByTestId('metric-expression-panel')).toContainText(
          metric.metricExpression.code
        );
        if (scene === 'assets') {
          await page.getByRole('tab', { name: /^Assets\b/ }).click();
          await expect(
            page
              .getByTestId('warehouse-fact_orders')
              .getByRole('link', { name: 'Finance Orders', exact: true })
          ).toBeVisible();
          await expect(
            page.getByTestId('entity-summary-panel-container')
          ).toContainText(table.description);
        }
        if (scene === 'asset-picker') {
          await page.getByTestId('metric-add-assets-button').click();
          await expect(page.getByRole('dialog')).toBeVisible();
        }
        if (scene === 'hierarchy') {
          target = page.getByTestId('metric-hierarchy-card');
          await expect(
            target.getByTestId('metric-tree-child-child-americas')
          ).toBeVisible();
          await expect(
            target.getByTestId('metric-tree-child-child-emea')
          ).toBeVisible();
        }
        if (scene === 'definition')
          target = page.getByTestId('metric-definition-card');
        if (scene === 'related-metrics-edit') {
          await page
            .getByRole('button', { name: 'Edit Related Metrics', exact: true })
            .click();
          const search = page.getByRole('textbox', {
            name: 'Search Related Metrics',
            exact: true,
          });
          const selected = page.getByRole('checkbox', {
            name: 'Net Revenue',
            exact: true,
          });
          // React Aria hides the native checkbox; its label is the painted control.
          const label = page.getByText('Net Revenue', { exact: true });
          await label.scrollIntoViewIfNeeded();
          await expect(selected).toBeChecked();
          await expect(label).toBeInViewport({ ratio: 1 });
          await expect(search).toBeInViewport({ ratio: 1 });
        }
        if (scene.startsWith('definition-')) {
          await page.getByTestId('metric-definition-edit').click();
          const dialog = page.getByTestId('metric-definition-edit-dialog');
          await expect(
            dialog.getByRole('textbox', { name: /^Code\b/ })
          ).toHaveValue(metric.metricExpression.code);
          // The content pane caps its height independently of the outer dialog.
          target = dialog.locator('[class*="max-h-[70vh]"]');
          captureFrame = true;
          await withFullVisualTarget(page, target, async () => {
            if (METRIC_DEFINITION_MENUS[scene]) {
              await dialog
                .getByTestId(METRIC_DEFINITION_MENUS[scene])
                .getByRole('button')
                .click();
              await captureMenu();
            }
            if (
              ['definition-custom-unit', 'definition-validation'].includes(
                scene
              )
            ) {
              await dialog
                .getByTestId('metric-definition-unit-select')
                .getByRole('button')
                .click();
              await page
                .getByRole('option', { name: 'Other', exact: true })
                .click();
              await expect(
                dialog.getByTestId('metric-definition-custom-unit')
              ).toBeVisible();
            }
            if (scene === 'definition-validation') {
              await dialog.getByRole('textbox', { name: /^Code\b/ }).fill('');
              await dialog.getByTestId('metric-definition-save').click();
              await expect(dialog).toContainText('Code is required');
              await expect(dialog).toContainText(
                'Measurement Unit is required'
              );
            }
            if (scene === 'definition-save-error') {
              await dialog
                .getByRole('textbox', { name: /^Code\b/ })
                .fill('SUM(revenue)');
              await dialog.getByTestId('metric-definition-save').click();
              await expect(page.getByRole('alertdialog')).toContainText(
                'The visual fixture service is unavailable.'
              );
              // The detail updater reports rejection through its global notification.
              allowErrorFeedback = true;
              await expectVisualScreenshot(page, id, theme, {
                target: page.getByRole('alertdialog'),
                allowErrorFeedback,
                maxDiffPixelRatio: 0,
              });
              await expectVisualScreenshot(page, `${id}-frame`, theme, {
                allowErrorFeedback,
              });
              captured = true;
            }
          });
        }
      }
      if (!captured) {
        const capture = () =>
          expectVisualScreenshot(page, id, theme, {
            target,
            allowErrorFeedback,
            ...(target ? { maxDiffPixelRatio: 0 } : {}),
          });
        if (target) await withFullVisualTarget(page, target, capture);
        else await capture();
        if (captureFrame)
          await expectVisualScreenshot(page, `${id}-frame`, theme, {
            allowErrorFeedback,
          });
      }
      expect(
        errors,
        'Metric interactions must render without runtime errors'
      ).toEqual([]);
    });
  }
}
