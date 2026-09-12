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
import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { MetricClass } from '../../support/entity/MetricClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { performUserLogin } from '../../utils/user';

/**
 * Covers the governance surface added to Metric: the approval status a metric starts life
 * with, the observability rollup endpoint, and editing the Definition widget on Overview.
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

const createMetric = async (
  apiContext: APIRequestContext,
  data: Record<string, unknown>
): Promise<MetricApiResponse> => {
  const response = await apiContext.post('/api/v1/metrics', { data });

  expect(response.status()).toBe(201);

  return (await response.json()) as MetricApiResponse;
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

  test('edits the Metric definition from Overview', async ({ browser }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const metric = new MetricClass();
    const updatedExpression = `SUM(governed_revenue_${uuid()})`;

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);
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
      await attachScreenshot(
        page,
        'metric-definition-card',
        'metric-definition-edited'
      );
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });
});
