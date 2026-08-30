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
import { expect, Page, Route, test } from '@playwright/test';
import {
  FIXED_DATE,
  gotoForScreenshot,
  SCREENSHOT_OPTS,
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
    if (path.endsWith('/observability') && path.includes('/api/v1/metrics/')) {
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

    return route.continue();
  });
};

const maskVolatileChrome = (page: Page) => [
  page.locator('.Toastify__toast-container'),
  page.locator('[data-testid="global-search-suggestions"]'),
];

const expectMetricScreenshot = async (
  page: Page,
  name: string,
  viewport: 'desktop' | 'narrow'
) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(`metric-${name}-${viewport}.png`, {
    ...SCREENSHOT_OPTS,
    mask: maskVolatileChrome(page),
  });
};

const captureMetricScreens = async (
  page: Page,
  viewport: 'desktop' | 'narrow'
) => {
  await setupMetricRoutes(page);

  await gotoForScreenshot(page, '/metrics');
  await expect(page.getByTestId('metric-list-page')).toBeVisible();
  if (viewport === 'narrow') {
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('left-sidebar')).toHaveCSS('width', '72px');
  }
  await page.getByRole('radio', { name: 'Card' }).click();
  const metricCardView = page.getByTestId('metric-card-view');

  await expect(metricCardView).toBeVisible();
  await expect(
    metricCardView.getByText('Gross Margin', { exact: true })
  ).toBeVisible();
  await expectMetricScreenshot(page, 'list', viewport);

  await gotoForScreenshot(page, `/metric/${METRIC_FQN}`);
  await expect(page.getByTestId('metric-details-page')).toBeVisible();
  await expect(page.getByTestId('metric-hierarchy-card')).toBeVisible();
  if (viewport === 'narrow') {
    await expect(
      page
        .getByTestId('metric-breadcrumbs')
        .getByRole('link', { name: 'Profitability' })
    ).toBeHidden();
  }
  await expectMetricScreenshot(page, 'overview', viewport);

  await page.getByRole('tab', { name: /^Assets/ }).click();
  await expect(page.getByTestId('metric-assets-tab')).toBeVisible();
  await expect(page.getByTestId(`metric-asset-card-${TABLE_ID}`)).toBeVisible();
  const assetActivator = page.getByTestId(`metric-asset-activate-${TABLE_ID}`);

  if (viewport === 'narrow') {
    await assetActivator.evaluate((element: HTMLButtonElement) =>
      element.click()
    );
  } else {
    await assetActivator.click();
  }
  await expect(page.getByTestId('metric-asset-summary')).toBeVisible();
  await expectMetricScreenshot(page, 'assets', viewport);
  if (viewport === 'narrow') {
    await page
      .getByTestId('metric-asset-summary-drawer-header')
      .getByRole('button', { name: 'Close' })
      .click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }

  await page.getByRole('tab', { name: 'Observability' }).click();
  await expect(page.getByTestId('metric-observability-tab')).toBeVisible();
  await expect(page.getByTestId('metric-health-summary')).toContainText('83%');
  await expectMetricScreenshot(page, 'observability', viewport);

  await page.getByRole('tab', { name: /^Activity & Tasks/ }).click();
  await expect(page.getByTestId('metric-activity-tab')).toBeVisible();
  await expect(page.getByTestId('metric-activity-new-comment')).toBeVisible();
  await expectMetricScreenshot(page, 'activity', viewport);

  await page.getByRole('tab', { name: 'Approval Workflow' }).click();
  await expect(page.getByTestId('metric-approval-tab')).toBeVisible();
  await expect(page.getByTestId('metric-approval-history')).toBeVisible();
  await expectMetricScreenshot(page, 'approval', viewport);
};

const captureDarkMetricOverview = async (
  page: Page,
  viewport: 'desktop' | 'narrow'
) => {
  await page.addInitScript(() => localStorage.setItem('ui-theme', 'dark'));
  await setupMetricRoutes(page);
  await gotoForScreenshot(page, `/metric/${METRIC_FQN}`);
  await expect(page.getByTestId('metric-details-page')).toBeVisible();
  if (viewport === 'narrow') {
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('left-sidebar')).toHaveCSS('width', '72px');
  }
  await expect(page.getByTestId('metric-hierarchy-card')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark-mode/);
  await expectMetricScreenshot(page, 'overview-dark', viewport);
};

test('Metric surfaces match desktop baselines', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await captureMetricScreens(page, 'desktop');
});

test('Metric surfaces match narrow baselines', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 390 });
  await captureMetricScreens(page, 'narrow');
});

test('Metric overview matches dark desktop and narrow baselines', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await captureDarkMetricOverview(page, 'desktop');
  await page.setViewportSize({ height: 900, width: 390 });
  await captureDarkMetricOverview(page, 'narrow');
});
