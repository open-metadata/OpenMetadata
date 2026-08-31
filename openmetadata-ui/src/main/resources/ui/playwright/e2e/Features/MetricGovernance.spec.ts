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
import { APIRequestContext, expect, Page, Route, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { connectEdgeBetweenNodesViaAPI } from '../../utils/lineage';
import { performUserLogin } from '../../utils/user';

/**
 * Covers the governance surface added to Metric: the approval status a metric starts life with,
 * the linked-asset endpoints, and the health rollup — plus the tabs that surface them.
 */

interface EntityFixture {
  id: string;
  name: string;
  fullyQualifiedName: string;
  displayName?: string;
  type?: string;
}

interface MetricApiResponse extends EntityFixture {
  description?: string;
  entityStatus?: string;
}

interface ApprovalTaskApiResponse {
  about?: EntityFixture;
  availableTransitions?: Array<{
    id?: string;
    resolutionType?: string;
  }>;
  id?: number | string;
  status?: string;
  type?: string;
}

type ApprovalResolution = 'Approved' | 'Rejected';

interface MetricObservabilityApiResponse {
  assets: Array<{
    asset: EntityFixture;
    failed?: number;
    passed?: number;
    redacted?: boolean;
    score?: number;
  }>;
  dimensions: Array<{
    dimension: string;
    failed: number;
    passed: number;
    score: number;
    total: number;
  }>;
  health: string;
  incidents: Array<{
    asset?: EntityFixture;
    redacted?: boolean;
    testCase: EntityFixture;
  }>;
  linkedAssets: Array<{
    asset: EntityFixture;
    direction: 'downstream' | 'unrelated' | 'upstream';
  }>;
  reasonCode: string;
  score?: number;
  statusCounts: {
    aborted: number;
    failed: number;
    missing: number;
    passed: number;
    queued: number;
    terminal: number;
  };
  sourceCoverage: {
    restrictedTables: number;
    upstreamTables: number;
    visibleTables: number;
  };
  tests: Array<{
    asset?: EntityFixture;
    dimension?: string;
    redacted?: boolean;
    status?: string;
    testCase: EntityFixture;
  }>;
  upstreamAssetCount: number;
}

const createMetric = async (
  apiContext: APIRequestContext,
  data: Record<string, unknown>
): Promise<MetricApiResponse> => {
  const response = await apiContext.post('/api/v1/metrics', { data });

  expect(response.status()).toBe(201);

  return (await response.json()) as MetricApiResponse;
};

const createQualityTestCase = async (
  apiContext: APIRequestContext,
  data: {
    entityLink: string;
    name: string;
    parameterValues: Array<{ name: string; value: number }>;
    testDefinition: string;
  }
): Promise<EntityFixture> => {
  const response = await apiContext.post('/api/v1/dataQuality/testCases', {
    data,
  });

  expect(response.status()).toBe(201);

  return (await response.json()) as EntityFixture;
};

const addQualityTestResult = async (
  apiContext: APIRequestContext,
  testCaseFqn: string,
  status: 'Failed' | 'Success',
  timestamp: number
) => {
  const response = await apiContext.post(
    `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
      testCaseFqn
    )}`,
    {
      data: {
        result: status,
        testCaseStatus: status,
        testResultValue: [],
        timestamp,
      },
    }
  );

  expect(response.ok()).toBeTruthy();
};

const getMetricObservability = async (
  apiContext: APIRequestContext,
  metricId: string
): Promise<MetricObservabilityApiResponse> => {
  const response = await apiContext.get(
    `/api/v1/metrics/${metricId}/observability`
  );

  expect(response.ok()).toBeTruthy();

  return (await response.json()) as MetricObservabilityApiResponse;
};

const expectMetricStatus = async (
  apiContext: APIRequestContext,
  metricId: string,
  status: string
) =>
  expect
    .poll(
      async () => {
        const response = await apiContext.get(`/api/v1/metrics/${metricId}`);
        const metric = (await response.json()) as MetricApiResponse;

        return metric.entityStatus;
      },
      { intervals: [1_000, 2_000, 5_000], timeout: 120_000 }
    )
    .toBe(status);

const waitForOpenApprovalTask = async (
  apiContext: APIRequestContext,
  metricFqn: string,
  resolution: ApprovalResolution,
  previousTaskId?: string
) => {
  let taskId = '';

  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/tasks?aboutEntity=${encodeURIComponent(
            metricFqn
          )}&type=RequestApproval&status=Open&limit=10&fields=assignees,availableTransitions,createdBy,resolution,reviewers`
        );
        if (!response.ok()) {
          return '';
        }
        const taskList = (await response.json()) as {
          data?: ApprovalTaskApiResponse[];
        };
        const task = taskList.data?.find(
          (candidate) =>
            String(candidate.id ?? '') !== previousTaskId &&
            candidate.availableTransitions?.some(
              (transition) => transition.resolutionType === resolution
            )
        );
        taskId = String(task?.id ?? '');

        return taskId;
      },
      {
        intervals: [1_000, 2_000, 5_000],
        timeout: 120_000,
      }
    )
    .not.toBe('');

  return taskId;
};

const expectAssignedTaskNotification = async (
  apiContext: APIRequestContext,
  taskId: string,
  metricFqn: string,
  status: ApprovalResolution
) =>
  expect
    .poll(
      async () => {
        const response = await apiContext.get('/api/v1/tasks/assigned', {
          params: {
            fields: 'about,assignees,createdBy,resolution',
            limit: 100,
            status,
          },
        });
        if (!response.ok()) {
          return;
        }
        const taskList = (await response.json()) as {
          data?: ApprovalTaskApiResponse[];
        };
        const notification = taskList.data?.find(
          (task) => String(task.id ?? '') === taskId
        );

        return notification
          ? {
              aboutFqn: notification.about?.fullyQualifiedName,
              aboutType: notification.about?.type,
              status: notification.status,
              taskId: String(notification.id ?? ''),
              type: notification.type,
            }
          : undefined;
      },
      { intervals: [1_000, 2_000, 5_000], timeout: 120_000 }
    )
    .toEqual({
      aboutFqn: metricFqn,
      aboutType: 'metric',
      status,
      taskId,
      type: 'RequestApproval',
    });

const visitMetricApproval = async (
  page: Page,
  metricFqn: string,
  expectedAction: 'approve' | 'reject'
) => {
  await page.goto(`/metric/${encodeURIComponent(metricFqn)}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByTestId('metric-details-page')).toBeVisible({
    timeout: 60_000,
  });
  await page.getByTestId('approval').click();
  await expect(
    page.getByTestId(`metric-approval-${expectedAction}-btn`)
  ).toBeVisible({ timeout: 60_000 });
};

const resolveApprovalInUi = async (
  page: Page,
  taskId: string,
  resolution: ApprovalResolution,
  note: string
) => {
  const action = resolution === 'Approved' ? 'approve' : 'reject';
  const actionButton = page.getByTestId(`metric-approval-${action}-btn`);

  if (resolution === 'Rejected') {
    await expect(actionButton).toBeDisabled();
  }
  await page
    .getByTestId('metric-approval-note')
    .getByRole('textbox')
    .fill(note);
  await expect(actionButton).toBeEnabled();

  const resolveResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      response.request().method() === 'POST' &&
      url.pathname.endsWith(`/api/v1/tasks/${taskId}/resolve`)
    );
  });
  await actionButton.click();
  expect((await resolveResponse).ok()).toBeTruthy();
};

const patchMetricDescription = async (
  apiContext: APIRequestContext,
  metricId: string,
  description: string
) => {
  const response = await apiContext.patch(`/api/v1/metrics/${metricId}`, {
    data: [{ op: 'replace', path: '/description', value: description }],
    headers: { 'Content-Type': 'application/json-patch+json' },
  });

  expect(response.ok()).toBeTruthy();
};

const expectMetricSnapshot = async (
  apiContext: APIRequestContext,
  metricId: string,
  expected: Pick<MetricApiResponse, 'description' | 'entityStatus'>
) =>
  expect
    .poll(
      async () => {
        const response = await apiContext.get(`/api/v1/metrics/${metricId}`);
        if (!response.ok()) {
          return {};
        }
        const metric = (await response.json()) as MetricApiResponse;

        return {
          description: metric.description,
          entityStatus: metric.entityStatus,
        };
      },
      { intervals: [1_000, 2_000, 5_000], timeout: 120_000 }
    )
    .toEqual(expected);

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  });

const attachScreenshot = async (page: Page, testId: string, name: string) => {
  const target = page.getByTestId(testId);
  await expect(target).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const firstBounds = await target.boundingBox();

  expect(firstBounds).not.toBeNull();
  expect(firstBounds?.width).toBeGreaterThan(0);
  expect(firstBounds?.height).toBeGreaterThan(0);

  await target.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

  const stableBounds = await target.boundingBox();

  expect(stableBounds).not.toBeNull();
  expect(
    Math.abs((stableBounds?.x ?? 0) - (firstBounds?.x ?? 0))
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs((stableBounds?.y ?? 0) - (firstBounds?.y ?? 0))
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs((stableBounds?.width ?? 0) - (firstBounds?.width ?? 0))
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs((stableBounds?.height ?? 0) - (firstBounds?.height ?? 0))
  ).toBeLessThanOrEqual(1);

  const body = await target.screenshot({ animations: 'disabled' });
  const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio);
  const pngWidth = body.readUInt32BE(16);
  const pngHeight = body.readUInt32BE(20);

  expect(body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(body.byteLength).toBeGreaterThan(1_024);
  expect(pngWidth).toBeGreaterThan(0);
  expect(pngHeight).toBeGreaterThan(0);
  expect(
    Math.abs(
      pngWidth - Math.round((stableBounds?.width ?? 0) * devicePixelRatio)
    )
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(
      pngHeight - Math.round((stableBounds?.height ?? 0) * devicePixelRatio)
    )
  ).toBeLessThanOrEqual(2);

  await test.info().attach(name, {
    body,
    contentType: 'image/png',
  });
};

test.describe('Metric Governance', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('a metric with no reviewers is approved on creation', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    let metricId: string | undefined;

    try {
      const metric = await createMetric(apiContext, {
        name: `pw-metric-auto-approved-${uuid()}`,
        description: 'No reviewers, so nothing to approve',
      });
      metricId = metric.id;

      expect(metric.entityStatus).toBe('Approved');
    } finally {
      if (metricId) {
        await apiContext.delete(
          `/api/v1/metrics/${metricId}?recursive=true&hardDelete=true`
        );
      }
      await afterAction();
    }
  });

  test('a complete non-reviewer change enters review automatically', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const reviewer = new UserClass();
    let metricId: string | undefined;

    try {
      await reviewer.create(apiContext);

      const metric = await createMetric(apiContext, {
        name: `pw-metric-reviewed-${uuid()}`,
        description: 'Awaiting review',
        reviewers: [{ id: reviewer.responseData.id, type: 'user' }],
      });
      metricId = metric.id;

      await expectMetricStatus(apiContext, metric.id, 'In Review');
    } finally {
      if (metricId) {
        await apiContext.delete(
          `/api/v1/metrics/${metricId}?recursive=true&hardDelete=true`
        );
      }
      await reviewer.delete(apiContext);
      await afterAction();
    }
  });

  test('lets the assigned reviewer approve a real Metric workflow in the UI', async ({
    browser,
  }) => {
    test.setTimeout(5 * 60 * 1_000);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const reviewer = new UserClass(undefined, true);
    const decisionNote = `Approved from the Metric UI ${uuid()}`;
    let metricId: string | undefined;
    let openTaskId = '';
    let reviewerCreated = false;
    let reviewerAfterAction: (() => Promise<void>) | undefined;

    try {
      await reviewer.create(apiContext);
      reviewerCreated = true;

      const metric = await createMetric(apiContext, {
        description: 'Metric awaiting a real reviewer decision',
        name: `pw-metric-ui-approval-${uuid()}`,
        reviewers: [{ id: reviewer.responseData.id, type: 'user' }],
      });
      metricId = metric.id;

      await expectMetricStatus(apiContext, metric.id, 'In Review');
      await expect
        .poll(
          async () => {
            const response = await apiContext.get(
              `/api/v1/tasks?aboutEntity=${encodeURIComponent(
                metric.fullyQualifiedName
              )}&type=RequestApproval&status=Open&limit=1&fields=assignees,availableTransitions,createdBy,resolution,reviewers`
            );
            if (!response.ok()) {
              return false;
            }
            const taskList = (await response.json()) as {
              data?: Array<{
                availableTransitions?: Array<{
                  id?: string;
                  resolutionType?: string;
                }>;
                id?: number | string;
              }>;
            };
            const task = taskList.data?.[0];
            const approvalTransition = task?.availableTransitions?.find(
              ({ resolutionType }) => resolutionType === 'Approved'
            );
            openTaskId = String(task?.id ?? '');

            return Boolean(openTaskId && approvalTransition?.id);
          },
          {
            intervals: [1_000, 2_000, 5_000],
            timeout: 120_000,
          }
        )
        .toBe(true);
      expect(openTaskId).not.toBe('');

      const reviewerSession = await performUserLogin(browser, reviewer);
      reviewerAfterAction = reviewerSession.afterAction;
      const reviewerPage = reviewerSession.page;
      await reviewerPage.goto(
        `/metric/${encodeURIComponent(metric.fullyQualifiedName)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await expect(reviewerPage.getByTestId('metric-details-page')).toBeVisible(
        { timeout: 60_000 }
      );
      await reviewerPage.getByTestId('approval').click();
      await expect(
        reviewerPage.getByTestId('metric-approval-approve-btn')
      ).toBeVisible({ timeout: 60_000 });
      await reviewerPage
        .getByTestId('metric-approval-note')
        .getByRole('textbox')
        .fill(decisionNote);

      const resolveResponse = reviewerPage.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          response.request().method() === 'POST' &&
          url.pathname.endsWith(`/api/v1/tasks/${openTaskId}/resolve`)
        );
      });
      await reviewerPage.getByTestId('metric-approval-approve-btn').click();
      expect((await resolveResponse).ok()).toBeTruthy();

      await expectMetricStatus(
        reviewerSession.apiContext,
        metric.id,
        'Approved'
      );
      await expectAssignedTaskNotification(
        reviewerSession.apiContext,
        openTaskId,
        metric.fullyQualifiedName,
        'Approved'
      );
      await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
      await expect(
        reviewerPage
          .getByTestId('metric-detail-header')
          .getByTestId('metric-status-pill')
      ).toContainText('Approved');
      await reviewerPage.getByTestId('approval').click();
      await expect(
        reviewerPage.getByTestId('metric-approval-status-pill')
      ).toContainText('Approved');
      await expect(
        reviewerPage.getByTestId('metric-approval-history')
      ).toContainText(decisionNote, { timeout: 60_000 });
      await attachScreenshot(
        reviewerPage,
        'metric-approval-tab',
        'metric-approval-real'
      );
    } finally {
      try {
        await reviewerAfterAction?.();
      } finally {
        try {
          if (metricId) {
            await apiContext.delete(
              `/api/v1/metrics/${metricId}?recursive=true&hardDelete=true`
            );
          }
        } finally {
          try {
            if (reviewerCreated) {
              await reviewer.delete(apiContext);
            }
          } finally {
            await afterAction();
          }
        }
      }
    }
  });

  test('a reviewer-authored metric change is auto-approved', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const reviewer = new UserClass(undefined, true);
    let reviewerAfterAction: (() => Promise<void>) | undefined;
    let metricId: string | undefined;

    try {
      await reviewer.create(apiContext);
      const reviewerSession = await performUserLogin(browser, reviewer);
      reviewerAfterAction = reviewerSession.afterAction;
      const metric = await createMetric(reviewerSession.apiContext, {
        name: `pw-metric-reviewer-authored-${uuid()}`,
        description: 'Complete metric authored by its reviewer',
        reviewers: [{ id: reviewer.responseData.id, type: 'user' }],
      });
      metricId = metric.id;

      await expectMetricStatus(
        reviewerSession.apiContext,
        metric.id,
        'Approved'
      );
    } finally {
      await reviewerAfterAction?.();
      if (metricId) {
        await apiContext.delete(
          `/api/v1/metrics/${metricId}?recursive=true&hardDelete=true`
        );
      }
      await reviewer.delete(apiContext);
      await afterAction();
    }
  });

  test('reports Unknown health with a reason when nothing is linked', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    let metricId: string | undefined;

    try {
      const metric = await createMetric(apiContext, {
        name: `pw-metric-health-${uuid()}`,
        description: 'No assets linked',
      });
      metricId = metric.id;

      const response = await apiContext.get(
        `/api/v1/metrics/${metric.id}/observability`
      );

      expect(response.ok()).toBeTruthy();

      const observability = await response.json();

      expect(observability.health).toBe('Unknown');
      expect(observability.upstreamAssetCount).toBe(0);
      expect(observability.reasonCode).toBe('NoLinkedAssets');
      expect(observability.statusCounts).toEqual({
        aborted: 0,
        failed: 0,
        missing: 0,
        passed: 0,
        queued: 0,
        terminal: 0,
      });
    } finally {
      if (metricId) {
        await apiContext.delete(
          `/api/v1/metrics/${metricId}?recursive=true&hardDelete=true`
        );
      }
      await afterAction();
    }
  });

  test('renders the dedicated governance tabs and narrow assets state', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      await expect(page.getByTestId('assets')).toBeVisible();
      await expect(page.getByTestId('data_observability')).toBeVisible();
      await expect(page.getByTestId('activity_feed')).toBeVisible();
      await expect(page.getByTestId('approval')).toBeVisible();

      const assetsResponse = await apiContext.get(
        `/api/v1/metrics/${metric.entityResponseData.id}/assets?limit=10&offset=0`
      );
      expect(assetsResponse.ok()).toBeTruthy();
      expect(await assetsResponse.json()).toEqual(
        expect.objectContaining({ data: [], paging: expect.any(Object) })
      );

      await page.setViewportSize({ height: 844, width: 390 });
      await page.getByTestId('assets').click();
      await expect(page.getByTestId('metric-assets-tab')).toBeVisible();
      await expect(page.getByTestId('metric-assets-results')).toBeVisible();
      const assetsBounds = await page
        .getByTestId('metric-assets-tab')
        .boundingBox();
      expect(assetsBounds?.width).toBeLessThanOrEqual(390);
      await attachScreenshot(page, 'metric-assets-tab', 'metric-assets-narrow');

      await page.getByTestId('activity_feed').click();
      await expect(page.getByTestId('metric-activity-tab')).toBeVisible();
      await expect(
        page.getByRole('tablist', { name: /activity/i })
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('renders the generic lineage graph and hides editing from read-only users', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const metric = new MetricClass();
    const readOnlyUser = new UserClass();
    let readOnlyAfterAction: (() => Promise<void>) | undefined;
    let userCreated = false;

    try {
      await metric.create(apiContext);
      await readOnlyUser.create(apiContext);
      userCreated = true;
      await metric.visitEntityPage(page);

      const adminLineageResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith('/api/v1/lineage/getLineage')
      );
      await page.getByTestId('lineage').click();
      expect((await adminLineageResponse).ok()).toBeTruthy();
      const adminLineage = page.getByTestId('lineage-details');
      await expect(adminLineage).toBeVisible();
      await expect(
        page.getByTestId('lineage-container').locator('.react-flow')
      ).toBeVisible();
      await expect(page.getByTestId('edit-lineage')).toBeVisible();

      const readOnlySession = await performUserLogin(browser, readOnlyUser);
      readOnlyAfterAction = readOnlySession.afterAction;
      await readOnlySession.page.goto(
        `/metric/${encodeURIComponent(
          metric.entityResponseData.fullyQualifiedName
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await expect(
        readOnlySession.page.getByTestId('metric-details-page')
      ).toBeVisible({ timeout: 60_000 });
      const readOnlyLineageResponse = readOnlySession.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith(
            '/api/v1/lineage/getLineage'
          )
      );
      await readOnlySession.page.getByTestId('lineage').click();
      expect((await readOnlyLineageResponse).ok()).toBeTruthy();
      await expect(
        readOnlySession.page
          .getByTestId('lineage-container')
          .locator('.react-flow')
      ).toBeVisible();
      await expect(
        readOnlySession.page.getByTestId('edit-lineage')
      ).toBeHidden();
    } finally {
      try {
        await readOnlyAfterAction?.();
      } finally {
        try {
          await metric.delete(apiContext);
        } finally {
          try {
            if (userCreated) {
              await readOnlyUser.delete(apiContext);
            }
          } finally {
            await afterAction();
          }
        }
      }
    }
  });

  test('filters, summarizes, selects, and unlinks Assets in bulk', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const metric = new MetricClass();
    const upstreamAsset = {
      displayName: 'Orders fact',
      fullyQualifiedName: 'sample.database.schema.orders_fact',
      id: '11111111-1111-4111-8111-111111111111',
      name: 'orders_fact',
      type: 'table',
    };
    const downstreamAsset = {
      displayName: 'Revenue dashboard',
      fullyQualifiedName: 'sample.dashboard.revenue_dashboard',
      id: '22222222-2222-4222-8222-222222222222',
      name: 'revenue_dashboard',
      type: 'dashboard',
    };
    const relations = [
      {
        affectsHealth: true,
        asset: upstreamAsset,
        direction: 'upstream',
      },
      {
        affectsHealth: false,
        asset: downstreamAsset,
        direction: 'downstream',
      },
    ];
    const linkedAssetIds = new Set<string>();
    let removedAssetIds: string[] = [];

    try {
      await metric.create(apiContext);

      await page.route('**/api/v1/metrics/**/assets**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const pathname = url.pathname;
        if (request.method() === 'PUT') {
          const payload = request.postDataJSON() as {
            assets?: Array<{ id: string }>;
          };
          const requestedAssets = payload.assets ?? [];
          if (pathname.endsWith('/assets/add')) {
            requestedAssets.forEach(({ id }) => linkedAssetIds.add(id));
          } else if (pathname.endsWith('/assets/remove')) {
            removedAssetIds = requestedAssets.map(({ id }) => id);
            removedAssetIds.forEach((id) => linkedAssetIds.delete(id));
          }

          return fulfillJson(route, {
            failedRequest: [],
            status: 'success',
            successRequest: requestedAssets.map((requestAsset) => ({
              request: requestAsset,
              status: 200,
            })),
          });
        }

        const query = (url.searchParams.get('q') ?? '').toLowerCase();
        const entityType = url.searchParams.get('entityType');
        const direction = url.searchParams.get('direction');
        const filtered = relations.filter(
          (relation) =>
            linkedAssetIds.has(relation.asset.id) &&
            (!query ||
              relation.asset.name.toLowerCase().includes(query) ||
              relation.asset.displayName.toLowerCase().includes(query) ||
              relation.asset.fullyQualifiedName
                .toLowerCase()
                .includes(query)) &&
            (!entityType || relation.asset.type === entityType) &&
            (!direction || relation.direction === direction)
        );
        const limit = Number(url.searchParams.get('limit')) || 10;
        const offset = Number(url.searchParams.get('offset')) || 0;

        return fulfillJson(route, {
          data: filtered.slice(offset, offset + limit),
          paging: { limit, offset, total: filtered.length },
        });
      });
      await page.route('**/api/v1/metrics/*/observability**', (route) =>
        fulfillJson(route, {
          assets: [
            {
              asset: upstreamAsset,
              failed: 0,
              health: 'Healthy',
              passed: 2,
              score: 100,
              total: 2,
            },
          ],
          dimensions: [],
          health: 'Healthy',
          incidents: [],
          linkedAssets: relations.filter(({ asset }) =>
            linkedAssetIds.has(asset.id)
          ),
          reasonCode: 'ScoreComputed',
          score: 100,
          statusCounts: {
            aborted: 0,
            failed: 0,
            missing: 0,
            passed: 2,
            queued: 0,
            terminal: 2,
          },
          tests: [],
          upstreamAssetCount: linkedAssetIds.has(upstreamAsset.id) ? 1 : 0,
        })
      );
      await page.route('**/api/v1/search/query**', (route) =>
        fulfillJson(route, {
          aggregations: {},
          hits: {
            hits: [upstreamAsset, downstreamAsset].map((asset) => ({
              _id: asset.id,
              _index: `${asset.type}_search_index`,
              _source: {
                description: `${asset.displayName} used by this metric`,
                displayName: asset.displayName,
                entityType: asset.type,
                fullyQualifiedName: asset.fullyQualifiedName,
                name: asset.name,
              },
            })),
            total: { value: 2 },
          },
        })
      );
      await page.route('**/api/v1/tables/name/**', (route) =>
        fulfillJson(route, {
          ...upstreamAsset,
          columns: [
            { displayName: 'Gross Amount', name: 'amount' },
            { name: 'order_id' },
          ],
          description: 'Orders used to compute the metric',
          domains: [{ id: 'domain-1', name: 'Commerce', type: 'domain' }],
          owners: [{ id: 'owner-1', name: 'Data Steward', type: 'user' }],
          tags: [
            { source: 'Classification', tagFQN: 'Tier.Tier1' },
            { source: 'Classification', tagFQN: 'PII.Sensitive' },
            { source: 'Glossary', tagFQN: 'BusinessGlossary.Revenue' },
          ],
          usageSummary: { weeklyStats: { count: 42, percentileRank: 95 } },
        })
      );
      await page.route('**/api/v1/dashboards/name/**', (route) =>
        fulfillJson(route, {
          ...downstreamAsset,
          description: 'Dashboard that consumes this metric',
          domains: [],
          owners: [],
          tags: [],
          usageSummary: { weeklyStats: { count: 7, percentileRank: 50 } },
        })
      );
      await page.route('**/api/v1/lineage/getLineage**', (route) =>
        fulfillJson(route, {
          downstreamEdges: [],
          entity: { id: metric.entityResponseData.id, type: 'metric' },
          nodes: [],
          upstreamEdges: [
            {
              fromEntity: upstreamAsset.id,
              lineageDetails: {
                columnsLineage: [
                  {
                    fromColumns: [`${upstreamAsset.fullyQualifiedName}.amount`],
                    toColumn: `${metric.entityResponseData.fullyQualifiedName}.gross_revenue`,
                  },
                ],
              },
              toEntity: metric.entityResponseData.id,
            },
          ],
        })
      );

      await metric.visitEntityPage(page);
      await page.getByTestId('assets').click();
      await page.getByTestId('metric-assets-add').click();
      const addDialog = page.getByTestId('metric-asset-add-dialog');
      await expect(addDialog).toBeVisible();
      const upstreamAddCheckbox = addDialog.getByRole('checkbox', {
        name: upstreamAsset.displayName,
      });
      const downstreamAddCheckbox = addDialog.getByRole('checkbox', {
        name: downstreamAsset.displayName,
      });
      await upstreamAddCheckbox.focus();
      await upstreamAddCheckbox.press('Space');
      await expect(upstreamAddCheckbox).toBeChecked();
      await downstreamAddCheckbox.focus();
      await downstreamAddCheckbox.press('Space');
      await expect(downstreamAddCheckbox).toBeChecked();

      const addRequestPromise = page.waitForRequest((request) => {
        const url = new URL(request.url());

        return (
          request.method() === 'PUT' && url.pathname.endsWith('/assets/add')
        );
      });
      await page.getByTestId('metric-asset-add-confirm').click();
      const addRequest = await addRequestPromise;
      const addPayload = addRequest.postDataJSON() as {
        assets: Array<{ id: string }>;
      };
      expect(addPayload.assets.map(({ id }) => id).sort()).toEqual(
        [upstreamAsset.id, downstreamAsset.id].sort()
      );
      await expect(addDialog).toBeHidden();

      const upstreamCard = page.getByTestId(
        `metric-asset-card-${upstreamAsset.id}`
      );
      const downstreamCard = page.getByTestId(
        `metric-asset-card-${downstreamAsset.id}`
      );
      await expect(upstreamCard).toBeVisible();
      await expect(upstreamCard).toContainText(upstreamAsset.displayName);
      await expect(upstreamCard).toContainText('Upstream');
      await expect(downstreamCard).toBeVisible();
      await expect(downstreamCard).toContainText(downstreamAsset.displayName);
      await expect(downstreamCard).toContainText('Downstream');
      await attachScreenshot(page, 'metric-assets-tab', 'metric-assets-linked');

      await page
        .getByTestId(`metric-asset-activate-${upstreamAsset.id}`)
        .click();
      const summary = page.getByTestId('metric-asset-summary');
      await expect(summary).toBeVisible();
      await expect(summary).toContainText('Orders used to compute the metric');
      await expect(summary).toContainText('Upstream');
      await expect(summary.getByText('sample', { exact: true })).toBeVisible();
      await expect(
        summary.getByText('database', { exact: true })
      ).toBeVisible();
      await expect(summary.getByText('schema', { exact: true })).toBeVisible();
      await expect(summary.getByText('42', { exact: true })).toBeVisible();
      await expect(summary).toContainText('Data Steward');
      await expect(summary).toContainText('Commerce');
      await expect(summary).toContainText('Tier.Tier1');
      await expect(summary).toContainText('PII.Sensitive');
      await expect(summary).toContainText('BusinessGlossary.Revenue');
      await expect(summary).toContainText('Gross Amount');
      await expect(summary).toContainText('order_id');
      await expect(summary).toContainText('Columns feeding this metric');
      await expect(summary).toContainText(
        `${upstreamAsset.fullyQualifiedName}.amount → ${metric.entityResponseData.fullyQualifiedName}.gross_revenue`
      );
      const viewAssetLink = summary.getByRole('link', {
        name: 'View Asset',
      });
      await expect(viewAssetLink).toHaveAttribute(
        'href',
        `/table/${upstreamAsset.fullyQualifiedName}`
      );
      await summary.getByRole('button', { name: 'Close' }).click();
      await page
        .getByTestId(`metric-asset-activate-${upstreamAsset.id}`)
        .click();
      const navigationLink = page
        .getByTestId('metric-asset-summary')
        .getByRole('link', { name: 'View Asset' });
      await Promise.all([
        page.waitForURL(
          (url) => url.pathname === `/table/${upstreamAsset.fullyQualifiedName}`
        ),
        navigationLink.click(),
      ]);
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('metric-assets-tab')).toBeVisible({
        timeout: 60_000,
      });

      const searchRequestPromise = page.waitForRequest((request) => {
        const url = new URL(request.url());

        return (
          request.method() === 'GET' &&
          url.pathname.endsWith(`/${metric.entityResponseData.id}/assets`) &&
          url.searchParams.get('q') === upstreamAsset.name
        );
      });
      await page.getByTestId('metric-assets-search').fill(upstreamAsset.name);
      await searchRequestPromise;
      await expect(upstreamCard).toBeVisible();
      await expect(downstreamCard).toBeHidden();

      const clearSearchRequestPromise = page.waitForRequest((request) => {
        const url = new URL(request.url());

        return (
          request.method() === 'GET' &&
          url.pathname.endsWith(`/${metric.entityResponseData.id}/assets`) &&
          url.searchParams.get('limit') === '10' &&
          !url.searchParams.has('q')
        );
      });
      await page.getByTestId('metric-assets-search').fill('');
      await clearSearchRequestPromise;
      await expect(downstreamCard).toBeVisible();

      const typeFilterRequestPromise = page.waitForRequest((request) => {
        const url = new URL(request.url());

        return (
          request.method() === 'GET' &&
          url.pathname.endsWith(`/${metric.entityResponseData.id}/assets`) &&
          url.searchParams.get('entityType') === 'table'
        );
      });
      await page.getByTestId('metric-assets-type-filter').click();
      await page.getByRole('option', { exact: true, name: 'Table' }).click();
      await typeFilterRequestPromise;
      await expect(upstreamCard).toBeVisible();
      await expect(downstreamCard).toBeHidden();

      const clearTypeRequestPromise = page.waitForRequest((request) => {
        const url = new URL(request.url());

        return (
          request.method() === 'GET' &&
          url.pathname.endsWith(`/${metric.entityResponseData.id}/assets`) &&
          url.searchParams.get('limit') === '10' &&
          !url.searchParams.has('entityType')
        );
      });
      await page.getByTestId('metric-assets-type-filter').click();
      await page.getByRole('option', { exact: true, name: 'All' }).click();
      await clearTypeRequestPromise;
      await expect(downstreamCard).toBeVisible();

      const directionFilterRequestPromise = page.waitForRequest((request) => {
        const url = new URL(request.url());

        return (
          request.method() === 'GET' &&
          url.pathname.endsWith(`/${metric.entityResponseData.id}/assets`) &&
          url.searchParams.get('direction') === 'downstream'
        );
      });
      await page.getByTestId('metric-assets-direction-filter').click();
      await page
        .getByRole('option', { exact: true, name: 'Downstream' })
        .click();
      await directionFilterRequestPromise;
      await expect(upstreamCard).toBeHidden();
      await expect(downstreamCard).toBeVisible();

      const clearDirectionRequestPromise = page.waitForRequest((request) => {
        const url = new URL(request.url());

        return (
          request.method() === 'GET' &&
          url.pathname.endsWith(`/${metric.entityResponseData.id}/assets`) &&
          url.searchParams.get('limit') === '10' &&
          !url.searchParams.has('direction')
        );
      });
      await page.getByTestId('metric-assets-direction-filter').click();
      await page.getByRole('option', { exact: true, name: 'All' }).click();
      await clearDirectionRequestPromise;
      await expect(upstreamCard).toBeVisible();

      const selectAll = page.getByRole('checkbox', { name: 'Select all' });
      await selectAll.focus();
      await selectAll.press('Space');
      await expect(selectAll).toBeChecked();
      await expect(upstreamCard.getByRole('checkbox')).toBeChecked();
      await expect(downstreamCard.getByRole('checkbox')).toBeChecked();
      await expect(page.getByText('2 items selected')).toBeVisible();

      const unlinkResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          response.request().method() === 'PUT' &&
          url.pathname.endsWith('/assets/remove')
        );
      });
      await page.getByTestId('metric-assets-bulk-unlink').click();
      const unlinkResponse = await unlinkResponsePromise;
      const unlinkRequest = unlinkResponse.request();
      const unlinkPayload = unlinkRequest.postDataJSON() as {
        assets: Array<{ id: string }>;
      };
      expect(unlinkPayload.assets.map(({ id }) => id).sort()).toEqual(
        [upstreamAsset.id, downstreamAsset.id].sort()
      );
      expect(removedAssetIds.sort()).toEqual(
        [upstreamAsset.id, downstreamAsset.id].sort()
      );
      await expect(upstreamCard).toBeHidden();
      await expect(downstreamCard).toBeHidden();
      await expect(page.getByTestId('metric-assets-bulk-result')).toContainText(
        'Success'
      );
      await expect(page.getByTestId('metric-assets-results')).toContainText(
        'No data found'
      );
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('keeps Assets visible but hides relationship mutations for read-only users', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const metric = new MetricClass();
    const readOnlyUser = new UserClass();
    const asset = {
      displayName: 'Read-only orders',
      fullyQualifiedName: 'sample.database.schema.read_only_orders',
      id: '33333333-3333-4333-8333-333333333333',
      name: 'read_only_orders',
      type: 'table',
    };
    let readOnlyAfterAction: (() => Promise<void>) | undefined;
    let userCreated = false;
    const relationshipMutations: string[] = [];

    try {
      await metric.create(apiContext);
      await readOnlyUser.create(apiContext);
      userCreated = true;
      const readOnlySession = await performUserLogin(browser, readOnlyUser);
      readOnlyAfterAction = readOnlySession.afterAction;
      const readOnlyPage = readOnlySession.page;

      await readOnlyPage.route(
        '**/api/v1/metrics/**/assets**',
        async (route) => {
          const request = route.request();
          if (request.method() === 'PUT') {
            relationshipMutations.push(request.method());

            return fulfillJson(route, { message: 'Forbidden' }, 403);
          }

          return fulfillJson(route, {
            data: [
              {
                affectsHealth: true,
                asset,
                direction: 'upstream',
              },
            ],
            paging: { limit: 10, offset: 0, total: 1 },
          });
        }
      );
      await readOnlyPage.route('**/api/v1/metrics/*/observability**', (route) =>
        fulfillJson(route, {
          assets: [],
          dimensions: [],
          health: 'Unknown',
          incidents: [],
          linkedAssets: [{ affectsHealth: true, asset, direction: 'upstream' }],
          reasonCode: 'NoTerminalResults',
          statusCounts: {
            aborted: 0,
            failed: 0,
            missing: 0,
            passed: 0,
            queued: 0,
            terminal: 0,
          },
          tests: [],
          upstreamAssetCount: 1,
        })
      );
      await readOnlyPage.route('**/api/v1/tables/name/**', (route) =>
        fulfillJson(route, {
          ...asset,
          columns: [],
          description: 'Visible without relationship edit permission',
          domains: [],
          owners: [],
          tags: [],
        })
      );

      await readOnlyPage.goto(
        `/metric/${encodeURIComponent(
          metric.entityResponseData.fullyQualifiedName
        )}`,
        { waitUntil: 'domcontentloaded' }
      );
      await expect(readOnlyPage.getByTestId('metric-details-page')).toBeVisible(
        { timeout: 60_000 }
      );
      await readOnlyPage.getByTestId('assets').click();

      const readOnlyCard = readOnlyPage.getByTestId(
        `metric-asset-card-${asset.id}`
      );
      await expect(readOnlyCard).toBeVisible();
      await expect(readOnlyCard).toContainText(asset.displayName);
      await expect(
        readOnlyPage.getByTestId('metric-assets-search')
      ).toBeVisible();
      await expect(
        readOnlyPage.getByTestId('metric-assets-type-filter')
      ).toBeVisible();
      await expect(
        readOnlyPage.getByTestId('metric-assets-direction-filter')
      ).toBeVisible();
      await expect(readOnlyPage.getByTestId('metric-assets-add')).toHaveCount(
        0
      );
      await expect(
        readOnlyPage.getByTestId('metric-assets-bulk-unlink')
      ).toHaveCount(0);
      await expect(readOnlyCard.getByRole('checkbox')).toHaveCount(0);
      expect(relationshipMutations).toEqual([]);
    } finally {
      try {
        await readOnlyAfterAction?.();
      } finally {
        try {
          await metric.delete(apiContext);
        } finally {
          try {
            if (userCreated) {
              await readOnlyUser.delete(apiContext);
            }
          } finally {
            await afterAction();
          }
        }
      }
    }
  });

  test('shows the health pill and rollup reason on the observability tab', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);
      await page.getByTestId('data_observability').click();

      await expect(page.getByTestId('metric-health-pill')).toBeVisible();
      await expect(page.getByTestId('metric-rollup-reason')).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('scores only direct upstream table and column tests using their latest results', async ({
    browser,
  }) => {
    test.setTimeout(5 * 60 * 1_000);

    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const suffix = uuid();
    const table = new TableClass(`pw-metric-upstream-${suffix}`);
    const restrictedPolicy = new PolicyClass();
    const restrictedRole = new RolesClass();
    const restrictedUser = new UserClass();
    const lineageEdges: Array<{
      from: { id: string; type: string };
      to: { id: string; type: string };
    }> = [];
    let customDefinitionId: string | undefined;
    let metricId: string | undefined;
    let restrictedAfterAction: (() => Promise<void>) | undefined;
    let tableCreated = false;

    try {
      await table.create(apiContext);
      tableCreated = true;

      const upstream = table.entityResponseData as EntityFixture;
      const downstream = (await table.createAdditionalTable(
        {
          displayName: `Metric downstream ${suffix}`,
          name: `pw-metric-downstream-${suffix}`,
        },
        apiContext
      )) as EntityFixture;
      const unrelated = (await table.createAdditionalTable(
        {
          displayName: `Metric unrelated ${suffix}`,
          name: `pw-metric-unrelated-${suffix}`,
        },
        apiContext
      )) as EntityFixture;
      const metric = await createMetric(apiContext, {
        description: 'Metric with direct upstream observability coverage',
        name: `pw-metric-observability-${suffix}`,
      });
      metricId = metric.id;

      const definitionResponse = await apiContext.post(
        '/api/v1/dataQuality/testDefinitions',
        {
          data: {
            dataQualityDimension: 'Consistency',
            entityType: 'TABLE',
            name: `pw-metric-consistency-${suffix}`,
            supportedDataTypes: ['NUMBER'],
            testPlatforms: ['OpenMetadata'],
          },
        }
      );
      expect(definitionResponse.status()).toBe(201);
      const customDefinition =
        (await definitionResponse.json()) as EntityFixture;
      customDefinitionId = customDefinition.id;

      const upstreamTableTest = await createQualityTestCase(apiContext, {
        entityLink: `<#E::table::${upstream.fullyQualifiedName}>`,
        name: `pw_upstream_consistency_${suffix}`,
        parameterValues: [],
        testDefinition: customDefinition.fullyQualifiedName,
      });
      const upstreamColumnTest = await createQualityTestCase(apiContext, {
        entityLink: `<#E::table::${upstream.fullyQualifiedName}::columns::${table.columnsName[0]}>`,
        name: `pw_upstream_column_${suffix}`,
        parameterValues: [],
        testDefinition: 'columnValuesToBeNotNull',
      });
      const downstreamTest = await createQualityTestCase(apiContext, {
        entityLink: `<#E::table::${downstream.fullyQualifiedName}>`,
        name: `pw_downstream_failed_${suffix}`,
        parameterValues: [
          { name: 'minValue', value: 1 },
          { name: 'maxValue', value: 2 },
        ],
        testDefinition: 'tableRowCountToBeBetween',
      });
      const unrelatedTest = await createQualityTestCase(apiContext, {
        entityLink: `<#E::table::${unrelated.fullyQualifiedName}>`,
        name: `pw_unrelated_failed_${suffix}`,
        parameterValues: [
          { name: 'minValue', value: 1 },
          { name: 'maxValue', value: 2 },
        ],
        testDefinition: 'tableRowCountToBeBetween',
      });

      const resultStart = Date.now() - 10_000;
      await addQualityTestResult(
        apiContext,
        upstreamTableTest.fullyQualifiedName,
        'Failed',
        resultStart + 100
      );
      await addQualityTestResult(
        apiContext,
        upstreamColumnTest.fullyQualifiedName,
        'Success',
        resultStart + 200
      );
      await addQualityTestResult(
        apiContext,
        upstreamTableTest.fullyQualifiedName,
        'Success',
        resultStart + 300
      );
      await addQualityTestResult(
        apiContext,
        upstreamColumnTest.fullyQualifiedName,
        'Failed',
        resultStart + 400
      );
      await addQualityTestResult(
        apiContext,
        downstreamTest.fullyQualifiedName,
        'Failed',
        resultStart + 500
      );
      await addQualityTestResult(
        apiContext,
        unrelatedTest.fullyQualifiedName,
        'Failed',
        resultStart + 600
      );

      const linkResponse = await apiContext.put(
        `/api/v1/metrics/${encodeURIComponent(
          metric.fullyQualifiedName
        )}/assets/add`,
        {
          data: {
            assets: [upstream, downstream, unrelated].map((asset) => ({
              id: asset.id,
              type: 'table',
            })),
          },
        }
      );
      expect(linkResponse.ok()).toBeTruthy();

      const upstreamEdge = {
        from: { id: upstream.id, type: 'table' },
        to: { id: metric.id, type: 'metric' },
      };
      const upstreamLineageResponse = await connectEdgeBetweenNodesViaAPI(
        apiContext,
        upstreamEdge.from,
        upstreamEdge.to
      );
      expect(upstreamLineageResponse.ok()).toBeTruthy();
      lineageEdges.push(upstreamEdge);

      const downstreamEdge = {
        from: { id: metric.id, type: 'metric' },
        to: { id: downstream.id, type: 'table' },
      };
      const downstreamLineageResponse = await connectEdgeBetweenNodesViaAPI(
        apiContext,
        downstreamEdge.from,
        downstreamEdge.to
      );
      expect(downstreamLineageResponse.ok()).toBeTruthy();
      lineageEdges.push(downstreamEdge);

      await expect
        .poll(
          async () => {
            const observability = await getMetricObservability(
              apiContext,
              metric.id
            );

            return {
              failed: observability.statusCounts.failed,
              passed: observability.statusCounts.passed,
              score: observability.score,
              terminal: observability.statusCounts.terminal,
              upstreamAssetCount: observability.upstreamAssetCount,
            };
          },
          {
            intervals: [1_000, 2_000, 5_000],
            timeout: 120_000,
          }
        )
        .toEqual({
          failed: 1,
          passed: 1,
          score: 50,
          terminal: 2,
          upstreamAssetCount: 1,
        });

      const observability = await getMetricObservability(apiContext, metric.id);
      expect(observability.health).toBe('Degraded');
      expect(observability.reasonCode).toBe('Degraded');
      expect(observability.statusCounts).toEqual({
        aborted: 0,
        failed: 1,
        missing: 0,
        passed: 1,
        queued: 0,
        terminal: 2,
      });
      expect(observability.assets).toHaveLength(1);
      expect(observability.assets[0]).toEqual(
        expect.objectContaining({
          asset: expect.objectContaining({ id: upstream.id }),
          failed: 1,
          passed: 1,
          score: 50,
        })
      );

      const linkedDirections = new Map(
        observability.linkedAssets.map(({ asset, direction }) => [
          asset.id,
          direction,
        ])
      );
      expect(linkedDirections).toEqual(
        new Map([
          [upstream.id, 'upstream'],
          [downstream.id, 'downstream'],
          [unrelated.id, 'unrelated'],
        ])
      );

      const consistency = observability.dimensions.find(
        ({ dimension }) => dimension === 'Consistency'
      );
      expect(consistency).toEqual(
        expect.objectContaining({ failed: 0, passed: 1, score: 100, total: 1 })
      );
      expect(observability.tests).toHaveLength(2);
      expect(observability.tests.map(({ testCase }) => testCase.id)).toEqual(
        expect.arrayContaining([upstreamTableTest.id, upstreamColumnTest.id])
      );
      expect(
        observability.tests.every(({ asset }) => asset?.id === upstream.id)
      ).toBeTruthy();
      expect(
        observability.tests.some(({ testCase }) =>
          [downstreamTest.id, unrelatedTest.id].includes(testCase.id)
        )
      ).toBeFalsy();
      expect(observability.incidents.length).toBeGreaterThan(0);
      expect(
        observability.incidents.some(
          ({ testCase }) => testCase.id === upstreamColumnTest.id
        )
      ).toBeTruthy();

      await page.goto(
        `/metric/${encodeURIComponent(metric.fullyQualifiedName)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await page.getByTestId('data_observability').click();

      await expect(
        page.getByTestId('metric-health-summary').getByRole('progressbar')
      ).toHaveAttribute('aria-valuenow', '50');
      const statusCounts = page.getByTestId('metric-global-status-counts');
      await expect(
        statusCounts.locator(':scope > div').filter({ hasText: 'Passed' })
      ).toContainText('1');
      await expect(
        statusCounts.locator(':scope > div').filter({ hasText: 'Failed' })
      ).toContainText('1');
      await expect(
        page.getByTestId('metric-dimension-Consistency')
      ).toContainText('100%');
      await expect(
        page.getByTestId('metric-dimension-Consistency')
      ).toContainText('1/1');
      await expect(page.getByTestId('metric-asset-rollups')).toContainText(
        upstream.displayName ?? upstream.name
      );
      await expect(page.getByTestId('metric-asset-rollups')).not.toContainText(
        downstream.displayName ?? downstream.name
      );
      await expect(page.getByTestId('metric-asset-rollups')).not.toContainText(
        unrelated.displayName ?? unrelated.name
      );
      await expect(page.getByTestId('metric-tests')).toContainText(
        upstreamTableTest.name
      );
      await expect(page.getByTestId('metric-tests')).toContainText(
        upstreamColumnTest.name
      );
      await expect(page.getByTestId('metric-tests')).not.toContainText(
        downstreamTest.name
      );
      await expect(page.getByTestId('metric-tests')).not.toContainText(
        unrelatedTest.name
      );
      await expect(page.getByTestId('metric-incidents')).toContainText(
        upstreamColumnTest.name
      );
      await attachScreenshot(
        page,
        'metric-observability-tab',
        'metric-observability-real'
      );

      await restrictedUser.create(apiContext, false);
      const policy = await restrictedPolicy.create(apiContext, [
        {
          effect: 'allow',
          name: `pw-metric-observability-view-${suffix}`,
          operations: ['ViewAll', 'ViewBasic'],
          resources: ['metric'],
        },
      ]);
      const role = await restrictedRole.create(apiContext, [
        policy.fullyQualifiedName ?? policy.name,
      ]);
      await restrictedUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: role.id,
              name: role.name,
              type: 'role',
            },
          },
        ],
      });

      const restrictedSession = await performUserLogin(browser, restrictedUser);
      restrictedAfterAction = restrictedSession.afterAction;
      const restrictedObservability = await getMetricObservability(
        restrictedSession.apiContext,
        metric.id
      );

      expect(restrictedObservability.score).toBe(50);
      expect(restrictedObservability.statusCounts).toEqual(
        observability.statusCounts
      );
      expect(restrictedObservability.sourceCoverage).toEqual(
        expect.objectContaining({
          restrictedTables: 1,
          upstreamTables: 1,
          visibleTables: 0,
        })
      );
      expect(
        restrictedObservability.assets.every(
          ({ asset, redacted }) => redacted || !asset.name
        )
      ).toBeTruthy();
      expect(
        restrictedObservability.tests.every(
          ({ testCase, redacted }) => redacted || !testCase.name
        )
      ).toBeTruthy();
      expect(
        restrictedObservability.incidents.every(
          ({ testCase, redacted }) => redacted || !testCase.name
        )
      ).toBeTruthy();

      await restrictedSession.page.goto(
        `/metric/${encodeURIComponent(metric.fullyQualifiedName)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await expect(
        restrictedSession.page.getByTestId('metric-details-page')
      ).toBeVisible({ timeout: 60_000 });
      await restrictedSession.page.getByTestId('data_observability').click();
      await expect(
        restrictedSession.page
          .getByTestId('metric-health-summary')
          .getByRole('progressbar')
      ).toHaveAttribute('aria-valuenow', '50');
      await expect(
        restrictedSession.page.getByTestId('metric-observability-redacted')
      ).toBeVisible();
      await expect(
        restrictedSession.page.getByTestId('metric-tests')
      ).not.toContainText(upstreamColumnTest.name);
      await expect(
        restrictedSession.page.getByTestId('metric-incidents')
      ).not.toContainText(upstreamColumnTest.name);
    } finally {
      await restrictedAfterAction?.();
      if (restrictedUser.responseData.id) {
        await restrictedUser.delete(apiContext);
      }
      if (restrictedRole.responseData.id) {
        await restrictedRole.delete(apiContext);
      }
      if (restrictedPolicy.responseData.id) {
        await restrictedPolicy.delete(apiContext);
      }
      await Promise.allSettled(
        lineageEdges.map(({ from, to }) =>
          apiContext.delete(
            `/api/v1/lineage/${from.type}/${from.id}/${to.type}/${to.id}`
          )
        )
      );
      const entityCleanup: Array<Promise<unknown>> = [];
      if (metricId) {
        entityCleanup.push(
          apiContext.delete(
            `/api/v1/metrics/${metricId}?recursive=true&hardDelete=true`
          )
        );
      }
      if (tableCreated) {
        entityCleanup.push(table.delete(apiContext));
      }
      await Promise.allSettled(entityCleanup);
      try {
        if (customDefinitionId) {
          await apiContext.delete(
            `/api/v1/dataQuality/testDefinitions/${customDefinitionId}?hardDelete=true`
          );
        }
      } finally {
        await afterAction();
      }
    }
  });

  test('renders scored observability from upstream tests and incidents', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const metric = new MetricClass();
    const now = Date.now();
    const asset = {
      displayName: 'Orders fact',
      fullyQualifiedName: 'sample.database.schema.orders_fact',
      id: '22222222-2222-4222-8222-222222222222',
      name: 'orders_fact',
      type: 'table',
    };
    const testCase = {
      displayName: 'Orders are complete',
      fullyQualifiedName: 'sample.database.schema.orders_fact.orders_complete',
      id: '33333333-3333-4333-8333-333333333333',
      name: 'orders_complete',
      type: 'testCase',
    };

    try {
      await metric.create(apiContext);
      await page.route('**/api/v1/metrics/*/observability**', (route) =>
        fulfillJson(route, {
          assets: [
            {
              aborted: 0,
              asset,
              failed: 1,
              health: 'AtRisk',
              latestRunTime: now,
              passed: 3,
              score: 75,
              total: 4,
            },
          ],
          dimensions: [
            {
              aborted: 0,
              dimension: 'Completeness',
              failed: 1,
              passed: 3,
              score: 75,
              total: 4,
            },
          ],
          evaluatedAssetCount: 1,
          evaluatedAt: now,
          health: 'AtRisk',
          incidents: [
            {
              asset,
              id: 'incident-1',
              severity: 'Severity1',
              status: 'New',
              testCase,
              timestamp: now,
            },
          ],
          latestRunTime: now,
          linkedAssets: [{ affectsHealth: true, asset, direction: 'upstream' }],
          metric: {
            id: metric.entityResponseData.id,
            name: metric.entity.name,
            type: 'metric',
          },
          reasonCode: 'AtRisk',
          score: 75,
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
            passed: 3,
            queued: 0,
            terminal: 4,
          },
          tests: [
            {
              asset,
              dimension: 'Completeness',
              status: 'Success',
              testCase,
              timestamp: now,
            },
          ],
          upstreamAssetCount: 1,
        })
      );

      await metric.visitEntityPage(page);
      await page.getByTestId('data_observability').click();

      await expect(
        page.getByTestId('metric-health-summary').getByRole('progressbar')
      ).toHaveAttribute('aria-valuenow', '75');
      await expect(page.getByTestId('metric-rollup-reason')).toContainText(
        '75%'
      );
      await expect(page.getByTestId('metric-asset-rollups')).toContainText(
        asset.displayName
      );
      await expect(page.getByTestId('metric-tests')).toContainText(
        testCase.displayName
      );
      await expect(page.getByTestId('metric-incidents')).toContainText(
        testCase.displayName
      );
      await attachScreenshot(
        page,
        'metric-observability-tab',
        'metric-observability-scored'
      );
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('creates a conversation and a task from the Activity tab', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const metric = new MetricClass();
    const comment = `Validate metric definition ${uuid()}`;
    const taskTitle = `Clarify definition ${uuid()}`;
    const assignee = {
      displayName: 'Review User',
      fullyQualifiedName: 'review.user',
      id: '44444444-4444-4444-8444-444444444444',
      name: 'review.user',
      type: 'user',
    };
    const threads: Array<Record<string, unknown>> = [];
    const tasks: Array<Record<string, unknown>> = [];

    try {
      await metric.create(apiContext);
      await page.route('**/api/v1/activity/entity/metric/name/**', (route) =>
        fulfillJson(route, { data: [], paging: { total: 0 } })
      );
      await page.route('**/api/v1/feed**', async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (pathname.endsWith('/feed/count')) {
          return fulfillJson(route, {
            data: [
              {
                conversationCount: threads.length,
                entityLink: `<#E::metric::${metric.entity.name}>`,
                mentionCount: 0,
                taskCount: tasks.length,
              },
            ],
          });
        }
        if (request.method() === 'POST' && pathname.endsWith('/feed')) {
          const payload = request.postDataJSON() as {
            about?: string;
            message?: string;
            type?: string;
          };
          const thread = {
            about: payload.about ?? '',
            createdBy: 'admin',
            id: 'thread-1',
            message: payload.message ?? '',
            posts: [],
            postsCount: 0,
            threadTs: Date.now(),
            type: payload.type ?? 'Conversation',
            updatedAt: Date.now(),
          };
          threads.splice(0, threads.length, thread);

          return fulfillJson(route, thread, 201);
        }

        return fulfillJson(route, {
          data: threads,
          paging: { total: threads.length },
        });
      });
      await page.route('**/api/v1/tasks**', async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (pathname.endsWith('/tasks/count')) {
          return fulfillJson(route, {
            completed: 0,
            open: tasks.length,
            total: tasks.length,
          });
        }
        if (request.method() === 'POST' && pathname.endsWith('/tasks')) {
          const payload = request.postDataJSON() as {
            name?: string;
            payload?: Record<string, unknown>;
          };
          const task = {
            assignees: [assignee],
            category: 'MetadataUpdate',
            createdAt: Date.now(),
            createdBy: {
              id: 'admin-user',
              name: 'admin',
              type: 'user',
            },
            description: String(payload.payload?.newDescription ?? ''),
            displayName: payload.name ?? taskTitle,
            id: 'task-1',
            name: payload.name ?? taskTitle,
            status: 'Open',
            updatedAt: Date.now(),
          };
          tasks.splice(0, tasks.length, task);

          return fulfillJson(route, task, 201);
        }

        return fulfillJson(route, {
          data: tasks,
          paging: { total: tasks.length },
        });
      });
      await page.route('**/api/v1/search/query**', (route) =>
        fulfillJson(route, {
          aggregations: {},
          hits: {
            hits: [
              {
                _id: assignee.id,
                _index: 'user_search_index',
                _source: {
                  displayName: assignee.displayName,
                  entityType: assignee.type,
                  fullyQualifiedName: assignee.fullyQualifiedName,
                  name: assignee.name,
                },
              },
            ],
            total: { value: 1 },
          },
        })
      );

      await metric.visitEntityPage(page);
      await page.getByTestId('activity_feed').click();
      await page
        .getByTestId('metric-activity-composer')
        .getByRole('textbox')
        .fill(comment);
      await page.getByTestId('metric-activity-composer-submit').click();
      await expect(page.getByText(comment, { exact: true })).toBeVisible();

      const activityTab = page.getByTestId('metric-activity-tab');
      await activityTab.getByRole('tab', { name: /Tasks/ }).click();
      await page.getByTestId('metric-task-create').click();
      await expect(page.getByTestId('metric-task-create-dialog')).toBeVisible();
      await page.getByTestId('metric-task-create-title').fill(taskTitle);
      const assigneeCheckbox = page.getByRole('checkbox', {
        name: assignee.displayName,
      });
      await assigneeCheckbox.focus();
      await assigneeCheckbox.press('Space');
      await expect(assigneeCheckbox).toBeChecked();
      await page
        .getByTestId('metric-task-create-value')
        .getByRole('textbox')
        .fill('Use the governed net revenue definition.');
      await page.getByTestId('metric-task-create-submit').click();

      const taskCard = page.getByTestId('metric-task-item-task-1');
      await expect(taskCard).toBeVisible();
      await expect(taskCard).toContainText(taskTitle);
      await attachScreenshot(
        page,
        'metric-activity-tab',
        'metric-activity-task'
      );
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('shows the approval status pill on the approval tab', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);
      await page.getByTestId('approval').click();

      await expect(page.getByTestId('metric-approval-status')).toBeVisible();
      // No reviewers, so the metric was auto-approved and needs no decision.
      await expect(
        page.getByTestId('metric-approval-status-pill')
      ).toContainText('Approved');
      await expect(
        page.getByTestId('metric-approval-approve-btn')
      ).toBeHidden();
      await expect(page.getByRole('button', { name: 'Submit' })).toHaveCount(0);
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('uses real workflows for rejection, rollback, and reverse-chronological history', async ({
    browser,
  }) => {
    test.setTimeout(10 * 60 * 1_000);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const reviewer = new UserClass(undefined, true);
    const metricIds: string[] = [];
    let reviewerCreated = false;
    let reviewerAfterAction: (() => Promise<void>) | undefined;

    try {
      await reviewer.create(apiContext);
      reviewerCreated = true;

      const approvedDescription = `Approved definition ${uuid()}`;
      const pendingDescription = `Pending definition ${uuid()}`;
      const approvalNote = `Approved baseline ${uuid()}`;
      const rollbackNote = `Keep the approved definition ${uuid()}`;
      const rollbackMetric = await createMetric(apiContext, {
        description: approvedDescription,
        name: `pw-metric-real-rollback-${uuid()}`,
        reviewers: [{ id: reviewer.responseData.id, type: 'user' }],
      });
      metricIds.push(rollbackMetric.id);

      await expectMetricStatus(apiContext, rollbackMetric.id, 'In Review');
      const approvalTaskId = await waitForOpenApprovalTask(
        apiContext,
        rollbackMetric.fullyQualifiedName,
        'Approved'
      );
      const reviewerSession = await performUserLogin(browser, reviewer);
      reviewerAfterAction = reviewerSession.afterAction;
      const reviewerPage = reviewerSession.page;

      await visitMetricApproval(
        reviewerPage,
        rollbackMetric.fullyQualifiedName,
        'approve'
      );
      await resolveApprovalInUi(
        reviewerPage,
        approvalTaskId,
        'Approved',
        approvalNote
      );
      await expectMetricSnapshot(
        reviewerSession.apiContext,
        rollbackMetric.id,
        {
          description: approvedDescription,
          entityStatus: 'Approved',
        }
      );

      await patchMetricDescription(
        apiContext,
        rollbackMetric.id,
        pendingDescription
      );
      await expectMetricSnapshot(apiContext, rollbackMetric.id, {
        description: pendingDescription,
        entityStatus: 'In Review',
      });
      const rollbackTaskId = await waitForOpenApprovalTask(
        apiContext,
        rollbackMetric.fullyQualifiedName,
        'Rejected',
        approvalTaskId
      );

      await visitMetricApproval(
        reviewerPage,
        rollbackMetric.fullyQualifiedName,
        'reject'
      );
      await resolveApprovalInUi(
        reviewerPage,
        rollbackTaskId,
        'Rejected',
        rollbackNote
      );
      await expectMetricSnapshot(
        reviewerSession.apiContext,
        rollbackMetric.id,
        {
          description: approvedDescription,
          entityStatus: 'Approved',
        }
      );

      await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
      await reviewerPage.getByTestId('approval').click();
      await expect(
        reviewerPage.getByTestId('metric-approval-rollback')
      ).toBeVisible({ timeout: 60_000 });
      const rollbackHistory = reviewerPage.getByTestId(
        'metric-approval-history'
      );
      await expect(rollbackHistory).toContainText(rollbackNote, {
        timeout: 60_000,
      });
      await expect(rollbackHistory).toContainText(approvalNote);
      await expect
        .poll(async () => {
          const historyItems = await rollbackHistory
            .locator('li')
            .allTextContents();
          const rollbackIndex = historyItems.findIndex((item) =>
            item.includes(rollbackNote)
          );
          const approvalIndex = historyItems.findIndex((item) =>
            item.includes(approvalNote)
          );

          return (
            rollbackIndex >= 0 &&
            approvalIndex >= 0 &&
            rollbackIndex < approvalIndex
          );
        })
        .toBe(true);

      const rejectionNote = `Reject incomplete metric ${uuid()}`;
      const rejectedMetric = await createMetric(apiContext, {
        description: `Incomplete definition ${uuid()}`,
        name: `pw-metric-real-rejection-${uuid()}`,
        reviewers: [{ id: reviewer.responseData.id, type: 'user' }],
      });
      metricIds.push(rejectedMetric.id);

      await expectMetricStatus(apiContext, rejectedMetric.id, 'In Review');
      const rejectionTaskId = await waitForOpenApprovalTask(
        apiContext,
        rejectedMetric.fullyQualifiedName,
        'Rejected'
      );
      await visitMetricApproval(
        reviewerPage,
        rejectedMetric.fullyQualifiedName,
        'reject'
      );
      await resolveApprovalInUi(
        reviewerPage,
        rejectionTaskId,
        'Rejected',
        rejectionNote
      );
      await expectMetricStatus(
        reviewerSession.apiContext,
        rejectedMetric.id,
        'Rejected'
      );

      await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
      await reviewerPage.getByTestId('approval').click();
      await expect(
        reviewerPage.getByTestId('metric-approval-rejected')
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        reviewerPage.getByTestId('metric-approval-history')
      ).toContainText(rejectionNote, { timeout: 60_000 });
      await attachScreenshot(
        reviewerPage,
        'metric-approval-tab',
        'metric-approval-history-real'
      );
    } finally {
      try {
        await reviewerAfterAction?.();
      } finally {
        try {
          await Promise.all(
            metricIds.map((metricId) =>
              apiContext.delete(
                `/api/v1/metrics/${metricId}?recursive=true&hardDelete=true`
              )
            )
          );
        } finally {
          try {
            if (reviewerCreated) {
              await reviewer.delete(apiContext);
            }
          } finally {
            await afterAction();
          }
        }
      }
    }
  });

  test('edits the Metric definition from Overview', async ({ browser }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const metric = new MetricClass();
    const updatedExpression = `SUM(governed_revenue_${uuid()})`;

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);
      await expect(page.getByTestId('metric-overview')).toBeVisible();
      await page.getByTestId('metric-definition-edit').click();
      const dialog = page.getByTestId('metric-definition-edit-dialog');
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole('textbox', { name: /Code/ })
        .fill(updatedExpression);
      const patchResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().includes('/api/v1/metrics/')
      );
      await page.getByTestId('metric-definition-save').click();
      expect((await patchResponse).ok()).toBeTruthy();
      await expect(dialog).toBeHidden();
      await expect(page.getByTestId('metric-definition-card')).toContainText(
        updatedExpression
      );
      await attachScreenshot(page, 'metric-overview', 'metric-overview-edited');
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });
});
