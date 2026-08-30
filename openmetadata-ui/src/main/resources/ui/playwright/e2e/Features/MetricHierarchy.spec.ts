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
import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { RDG_ACTIVE_CELL_SELECTOR } from '../../constant/bulkImportExport';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { VIEW_ONLY_RULE } from '../../constant/permission';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { setupUserWithPolicy } from '../../utils/permission';
import { performUserLogin } from '../../utils/user';

/**
 * Metric hierarchy is a relationship-based tree over flat fully qualified names, so these tests
 * exercise the API contract directly: that a child is reachable from its parent, that the parent
 * filter partitions the list correctly, and that reparenting never rewrites a name.
 */

interface EntityReferenceResponse {
  id: string;
  name?: string;
  fullyQualifiedName?: string;
  type?: string;
}

interface MetricResponse {
  id: string;
  name: string;
  fullyQualifiedName: string;
  displayName?: string;
  entityStatus?: string;
  parent?: EntityReferenceResponse;
  children?: EntityReferenceResponse[];
  childrenCount?: number;
  metricGroup?: EntityReferenceResponse;
  reviewers?: EntityReferenceResponse[];
}

interface MetricListResponse {
  data: MetricResponse[];
}

interface MetricGroupResponse {
  id: string;
  name: string;
  fullyQualifiedName: string;
  metricCount?: number;
}

const createMetric = async (
  apiContext: APIRequestContext,
  name: string,
  parent?: string,
  metricGroup?: string,
  owners?: EntityReferenceResponse[]
): Promise<MetricResponse> => {
  const response = await apiContext.post('/api/v1/metrics', {
    data: {
      name,
      description: `Metric ${name}`,
      displayName: name,
      granularity: 'DAY',
      metricExpression: { code: 'COUNT(*)', language: 'SQL' },
      metricType: 'COUNT',
      unitOfMeasurement: 'COUNT',
      ...(parent ? { parent } : {}),
      ...(metricGroup ? { metricGroup } : {}),
      ...(owners?.length ? { owners } : {}),
    },
  });

  expect(response.status()).toBe(201);

  return (await response.json()) as MetricResponse;
};

const createMetricGroup = async (
  apiContext: APIRequestContext,
  name: string
): Promise<MetricGroupResponse> => {
  const response = await apiContext.post('/api/v1/metricGroups', {
    data: { name, displayName: name, description: `Metric group ${name}` },
  });

  expect(response.status()).toBe(201);

  return (await response.json()) as MetricGroupResponse;
};

const getMetric = async (
  apiContext: APIRequestContext,
  id: string,
  fields = 'parent,children,childrenCount'
): Promise<MetricResponse> => {
  const response = await apiContext.get(
    `/api/v1/metrics/${id}?fields=${fields}`
  );

  expect(response.ok()).toBeTruthy();

  return (await response.json()) as MetricResponse;
};

const listByParent = async (
  apiContext: APIRequestContext,
  parent: string
): Promise<MetricListResponse> => {
  const response = await apiContext.get(
    `/api/v1/metrics?parent=${encodeURIComponent(
      parent
    )}&fields=parent,childrenCount&limit=1000`
  );

  expect(response.ok()).toBeTruthy();

  return (await response.json()) as MetricListResponse;
};

const waitForMetricIndexed = async (
  apiContext: APIRequestContext,
  name: string
) => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/search/query?q=${encodeURIComponent(
            name
          )}&index=metric&from=0&size=10`
        );
        const data = (await response.json()) as {
          hits?: { total?: { value?: number } };
        };

        return data.hits?.total?.value ?? 0;
      },
      { timeout: 90_000 }
    )
    .toBeGreaterThan(0);
};

const waitForMetricHierarchySearch = (page: Page, query: string) =>
  page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      response.request().method() === 'GET' &&
      url.pathname.endsWith('/api/v1/metrics/hierarchy') &&
      url.searchParams.get('q') === query
    );
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

const fillRequiredMetricFields = async (page: Page, name: string) => {
  await page.getByTestId('name').fill(name);
  await page.getByTestId('metric-code').getByRole('textbox').fill('COUNT(*)');
};

const waitForMetricBulkEditGrid = async (page: Page, metricName: string) => {
  await expect(page).toHaveURL(/\/bulk\/edit\/metric\/\*/);
  await expect(page.locator('.rdg-header-row')).toBeVisible({
    timeout: 90_000,
  });
  await expect(
    page.locator('.bulk-edit-name-value').filter({ hasText: metricName })
  ).toBeVisible();
};

const editMetricDisplayName = async (
  page: Page,
  metricName: string,
  displayName: string
) => {
  const displayNameCell = page
    .locator('.rdg-row')
    .filter({ hasText: metricName })
    .locator('[aria-colindex="3"]');

  await displayNameCell.dblclick();
  const editor = page.locator(`${RDG_ACTIVE_CELL_SELECTOR} input`);
  await expect(editor).toBeVisible();
  await editor.fill(displayName);
  await editor.press('Enter');
  await expect(displayNameCell).toContainText(displayName);
};

const waitForMetricImportResponse = (page: Page, dryRun: boolean) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/api/v1/metrics/name/') &&
      response.url().includes('/importAsync') &&
      response.url().includes(`dryRun=${String(dryRun)}`)
  );

const expectMetricImportStatus = async (page: Page) => {
  await expect(page.getByTestId('processed-row')).toContainText('1');
  await expect(page.getByTestId('passed-row')).toContainText('1');
  await expect(page.getByTestId('failed-row')).toContainText('0');
  await expect(page.locator('.rdg-header-row')).toBeVisible();
};

test.describe('Metric Hierarchy', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('establishes a parent-child relationship without changing names', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const suffix = uuid();
    const parentName = `pw-metric-parent-${suffix}`;
    const childName = `pw-metric-child-${suffix}`;

    try {
      const parent = await createMetric(apiContext, parentName);
      const child = await createMetric(apiContext, childName, parentName);

      expect(child.parent?.id).toBe(parent.id);
      expect(child.fullyQualifiedName).toBe(childName);

      const fetchedParent = await getMetric(apiContext, parent.id);

      expect(fetchedParent.childrenCount).toBe(1);
      expect(fetchedParent.children).toHaveLength(1);
      expect(fetchedParent.children?.[0].id).toBe(child.id);
    } finally {
      await afterAction();
    }
  });

  test('partitions the listing into roots and immediate children', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const suffix = uuid();
    const parentName = `pw-metric-roots-${suffix}`;
    const childName = `pw-metric-kid-${suffix}`;
    const grandChildName = `pw-metric-grandkid-${suffix}`;

    try {
      const parent = await createMetric(apiContext, parentName);
      const child = await createMetric(apiContext, childName, parentName);
      const grandChild = await createMetric(
        apiContext,
        grandChildName,
        childName
      );

      const roots = await listByParent(apiContext, 'null');
      const rootIds = roots.data.map((m: { id: string }) => m.id);

      expect(rootIds).toContain(parent.id);
      expect(rootIds).not.toContain(child.id);

      const children = await listByParent(apiContext, parentName);
      const childIds = children.data.map((m: { id: string }) => m.id);

      expect(childIds).toEqual([child.id]);
      expect(childIds).not.toContain(grandChild.id);
    } finally {
      await afterAction();
    }
  });

  test('rejects a cycle when reparenting', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const suffix = uuid();
    const parentName = `pw-metric-cyc-a-${suffix}`;
    const childName = `pw-metric-cyc-b-${suffix}`;

    try {
      const parent = await createMetric(apiContext, parentName);
      const child = await createMetric(apiContext, childName, parentName);

      const response = await apiContext.patch(`/api/v1/metrics/${parent.id}`, {
        data: [
          {
            op: 'add',
            path: '/parent',
            value: { id: child.id, type: 'metric' },
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      expect(response.status()).toBe(400);
    } finally {
      await afterAction();
    }
  });

  test('moves the edge on reparent and keeps the fully qualified name', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const suffix = uuid();
    const oldParentName = `pw-metric-old-${suffix}`;
    const newParentName = `pw-metric-new-${suffix}`;
    const childName = `pw-metric-moved-${suffix}`;

    try {
      const oldParent = await createMetric(apiContext, oldParentName);
      const newParent = await createMetric(apiContext, newParentName);
      const child = await createMetric(apiContext, childName, oldParentName);

      const response = await apiContext.patch(`/api/v1/metrics/${child.id}`, {
        data: [
          {
            op: 'replace',
            path: '/parent',
            value: { id: newParent.id, type: 'metric' },
          },
        ],
        headers: { 'Content-Type': 'application/json-patch+json' },
      });

      expect(response.ok()).toBeTruthy();

      const moved = await response.json();

      expect(moved.fullyQualifiedName).toBe(childName);

      const oldParentAfter = await getMetric(apiContext, oldParent.id);
      const newParentAfter = await getMetric(apiContext, newParent.id);

      expect(oldParentAfter.childrenCount).toBe(0);
      expect(newParentAfter.childrenCount).toBe(1);
    } finally {
      await afterAction();
    }
  });

  test('lists roots and reveals children on expand in the list page', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const suffix = uuid();
    const parentName = `pw-metric-ui-parent-${suffix}`;
    const childName = `pw-metric-ui-child-${suffix}`;
    // Declared out here so the cleanup can still reach it.
    let parentId: string | undefined;

    try {
      parentId = (await createMetric(apiContext, parentName)).id;
      await createMetric(apiContext, childName, parentName);

      const rootsRequest = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          url.pathname.endsWith('/api/v1/metrics/hierarchy') &&
          url.searchParams.get('offset') === '0'
        );
      });
      await page.goto('/metrics');
      await rootsRequest;

      const searchResponse = waitForMetricHierarchySearch(page, parentName);
      await page
        .getByTestId('metric-search')
        .getByRole('textbox')
        .fill(parentName);
      expect((await searchResponse).ok()).toBeTruthy();

      // Metric variants remain collapsed until their parent is explicitly expanded.
      await expect(page.getByText(parentName, { exact: true })).toBeVisible();
      await expect(page.getByText(childName, { exact: true })).toBeHidden();

      const parentRow = page.getByRole('row', {
        name: new RegExp(parentName),
      });
      const metricsListUrl = page.url();

      await parentRow.locator('label[slot="selection"]').click();
      await expect(page).toHaveURL(metricsListUrl);
      await expect(page.getByTestId('bulk-edit-metric')).toBeVisible();
      await page.getByRole('button', { name: 'Clear' }).click();

      await parentRow.getByTestId(`expand-${parentId}`).click();

      await expect(page.getByText(childName, { exact: true })).toBeVisible();

      await parentRow.getByRole('link', { name: parentName }).click();
      await expect(page).toHaveURL(new RegExp(`/metric/${parentName}$`));
      await expect(page.getByTestId('metric-details-page')).toBeVisible();
    } finally {
      if (parentId) {
        await apiContext.delete(
          `/api/v1/metrics/${parentId}?hardDelete=true&recursive=true`
        );
      }
      await afterAction();
    }
  });

  test('switches list layouts and exercises group, search, filter, columns, and bulk controls', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const suffix = uuid();
    const groupName = `pw-metric-group-ui-${suffix}`;
    const rootName = `pw-metric-list-root-${suffix}`;
    const childName = `pw-metric-list-child-${suffix}`;
    let root: MetricResponse | undefined;
    let group: MetricGroupResponse | undefined;

    try {
      const createdGroup = await createMetricGroup(apiContext, groupName);
      group = createdGroup;
      root = await createMetric(
        apiContext,
        rootName,
        undefined,
        createdGroup.fullyQualifiedName
      );
      await createMetric(apiContext, childName, rootName);
      await waitForMetricIndexed(apiContext, rootName);

      const groupMetricsResponse = page.waitForResponse((response) =>
        response
          .url()
          .includes(`/api/v1/metricGroups/${createdGroup.id}/metrics`)
      );
      const hierarchyResponse = page.waitForResponse((response) =>
        response.url().includes('/api/v1/metrics/hierarchy')
      );
      await page.goto('/metrics');
      await Promise.all([hierarchyResponse, groupMetricsResponse]);

      const groupToggle = page.getByTestId(`metric-group-${groupName}`);
      await expect(groupToggle).toBeVisible();
      await expect(page.getByText(rootName, { exact: true })).toBeVisible();
      await expect(page.getByText(childName, { exact: true })).toBeHidden();

      await page.getByTestId('metric-card-view-button').click();
      await expect(page.getByTestId('metric-card-view')).toBeVisible();
      await expect(
        page.getByTestId(`metric-group-card-${groupName}`)
      ).toBeVisible();
      await attachScreenshot(page, 'metric-list-page', 'metric-list-card-view');
      await groupToggle.click();
      await expect(page.getByText(rootName, { exact: true })).toBeHidden();
      await groupToggle.click();
      await expect(page.getByText(rootName, { exact: true })).toBeVisible();

      await page.getByTestId('metric-table-view-button').click();
      await expect(page.getByRole('grid', { name: 'Metrics' })).toBeVisible();
      await page.getByTestId(`expand-${root.id}`).click();
      await expect(page.getByText(childName, { exact: true })).toBeVisible();

      const rootRow = page.getByRole('row', { name: new RegExp(rootName) });
      await rootRow.locator('label[slot="selection"]').click();
      await expect(page.getByTestId('bulk-edit-metric')).toBeVisible();
      await expect(page.getByTestId('bulk-delete-metric')).toBeVisible();
      await page.getByRole('button', { name: 'Clear' }).click();

      const searchResponse = waitForMetricHierarchySearch(page, rootName);
      await page
        .getByTestId('metric-search')
        .getByRole('textbox')
        .fill(rootName);
      await searchResponse;
      await expect(page.getByTestId('metric-name')).toHaveCount(1);
      await expect(page.getByText(rootName, { exact: true })).toBeVisible();

      const statusResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          url.pathname.endsWith('/api/v1/search/query') &&
          decodeURIComponent(
            url.searchParams.get('query_filter') ?? ''
          ).includes('Approved')
        );
      });
      await page.getByTestId('metric-search').getByRole('textbox').fill('');
      await page.getByRole('button', { name: 'Status', exact: true }).click();
      await page.getByRole('menuitemradio', { name: 'Approved' }).click();
      await statusResponse;
      await expect(rootRow.getByTestId('metric-status-pill')).toContainText(
        'Approved'
      );

      await page.getByRole('button', { name: 'Customize' }).click();
      await page
        .getByRole('button', { name: 'Description', exact: true })
        .click();
      await expect(
        page.getByRole('columnheader', { name: 'Description' })
      ).toHaveCount(0);
    } finally {
      if (root) {
        await apiContext.delete(
          `/api/v1/metrics/${root.id}?hardDelete=true&recursive=true`
        );
      }
      if (group) {
        await apiContext.delete(
          `/api/v1/metricGroups/${group.id}?hardDelete=true&recursive=true`
        );
      }
      await afterAction();
    }
  });

  test('executes bulk edit and bulk delete for selected metrics', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const suffix = uuid();
    const editableMetricName = `pw-metric-bulk-edit-${suffix}`;
    const deletableMetricName = `pw-metric-bulk-delete-${suffix}`;
    const updatedDisplayName = `Bulk edited metric ${suffix}`;
    let editableMetric: MetricResponse | undefined;
    let deletableMetric: MetricResponse | undefined;

    try {
      editableMetric = await createMetric(apiContext, editableMetricName);
      deletableMetric = await createMetric(apiContext, deletableMetricName);
      await Promise.all([
        waitForMetricIndexed(apiContext, editableMetricName),
        waitForMetricIndexed(apiContext, deletableMetricName),
      ]);

      const hierarchyResponse = page.waitForResponse((response) =>
        response.url().includes('/api/v1/metrics/hierarchy')
      );
      await page.goto('/metrics');
      await hierarchyResponse;

      const editableSearchResponse = waitForMetricHierarchySearch(
        page,
        editableMetricName
      );
      await page
        .getByTestId('metric-search')
        .getByRole('textbox')
        .fill(editableMetricName);
      await editableSearchResponse;

      const editableRow = page.getByRole('row', {
        name: new RegExp(editableMetricName),
      });
      await expect(editableRow).toBeVisible();
      await editableRow.locator('label[slot="selection"]').click();
      await page.getByTestId('bulk-edit-metric').click();
      await waitForMetricBulkEditGrid(page, editableMetricName);
      await editMetricDisplayName(page, editableMetricName, updatedDisplayName);

      const validateResponse = waitForMetricImportResponse(page, true);
      await page
        .locator('.bulk-edit-add-row-actions')
        .getByRole('button', { name: 'Next' })
        .click();
      expect((await validateResponse).ok()).toBeTruthy();
      await expectMetricImportStatus(page);

      const updateResponse = waitForMetricImportResponse(page, false);
      await page.getByRole('button', { name: 'Update' }).click();
      expect((await updateResponse).ok()).toBeTruthy();
      await page.waitForURL(/\/metrics(?:\?|$)/, { timeout: 90_000 });

      await expect
        .poll(
          async () => {
            const response = await apiContext.get(
              `/api/v1/metrics/name/${encodeURIComponent(editableMetricName)}`
            );

            if (!response.ok()) {
              return undefined;
            }

            return ((await response.json()) as MetricResponse).displayName;
          },
          { timeout: 90_000 }
        )
        .toBe(updatedDisplayName);

      const deletableSearchResponse = waitForMetricHierarchySearch(
        page,
        deletableMetricName
      );
      await page
        .getByTestId('metric-search')
        .getByRole('textbox')
        .fill(deletableMetricName);
      await deletableSearchResponse;

      const deletableRow = page.getByRole('row', {
        name: new RegExp(deletableMetricName),
      });
      await expect(deletableRow).toBeVisible();
      await deletableRow.locator('label[slot="selection"]').click();
      await page.getByTestId('bulk-delete-metric').click();
      await expect(
        page.getByRole('dialog', { name: 'Delete Metrics' })
      ).toBeVisible();

      const deleteResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'DELETE' &&
          new URL(response.url()).pathname.endsWith(
            `/api/v1/metrics/async/${deletableMetric?.id}`
          )
      );
      await page.getByTestId('confirm-button').click();
      expect((await deleteResponse).ok()).toBeTruthy();
      await expect(
        page.getByRole('dialog', { name: 'Delete Metrics' })
      ).toBeHidden();

      await expect
        .poll(
          async () =>
            (
              await apiContext.get(`/api/v1/metrics/${deletableMetric?.id}`)
            ).status(),
          { timeout: 90_000 }
        )
        .toBe(404);
    } finally {
      await Promise.all(
        [editableMetric, deletableMetric]
          .filter((metric): metric is MetricResponse => Boolean(metric))
          .map(({ id }) =>
            apiContext.delete(
              `/api/v1/metrics/${id}?hardDelete=true&recursive=true`
            )
          )
      );
      await afterAction();
    }
  });

  test('creates a group, root, and child from the UI and completes the Overview edit flow', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const suffix = uuid();
    const groupName = `pw-ui-created-group-${suffix}`;
    const rootName = `pw-ui-created-root-${suffix}`;
    const childName = `pw-ui-created-child-${suffix}`;
    let root: MetricResponse | undefined;
    let group: MetricGroupResponse | undefined;

    try {
      await page.goto('/metrics/add-metric');
      await fillRequiredMetricFields(page, rootName);
      const groupCombo = page
        .getByTestId('metric-group-select')
        .getByRole('combobox');
      const groupResolution = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith(
          `/api/v1/metricGroups/name/${encodeURIComponent(groupName)}`
        )
      );
      await groupCombo.fill(groupName);
      expect((await groupResolution).status()).toBe(404);
      const createGroupOption = page.getByRole('option', {
        name: new RegExp(`^Create ${groupName}`),
      });
      await groupCombo.press('ArrowDown');
      await expect(createGroupOption).toBeVisible();
      await groupCombo.press('End');
      await expect(createGroupOption).toHaveAttribute('data-focused', 'true');
      await groupCombo.press('Enter');
      await expect(groupCombo).toHaveValue(groupName);

      const groupCreateResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/api/v1/metricGroups')
      );
      const rootResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/api/v1/metrics')
      );
      await page.getByTestId('create-button').click();
      expect((await groupCreateResponse).ok()).toBeTruthy();
      root = (await (await rootResponse).json()) as MetricResponse;

      await expect(page.getByTestId('metric-details-page')).toBeVisible();
      await expect(page.getByRole('heading', { name: rootName })).toBeVisible();
      const detailHeader = page.getByTestId('metric-detail-header');
      await expect(detailHeader).toContainText(root.fullyQualifiedName);
      await expect(
        detailHeader.getByTestId('metric-status-pill')
      ).toContainText('Approved');
      await expect(detailHeader.getByTestId('metric-type')).toBeVisible();
      await expect(page.getByTestId('metric-definition-unit')).toBeVisible();
      await expect(detailHeader.getByTestId('granularity')).toBeVisible();
      await expect(
        detailHeader.getByTestId('metric-header-health-pill')
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId('metric-header-owner')).toBeVisible();
      await expect(page.getByTestId('metric-header-domain')).toBeVisible();
      await expect(page.getByTestId('metric-header-tier')).toBeVisible();
      await expect(page.getByTestId('metric-tree-group')).toContainText(
        groupName
      );
      await expect(page.getByTestId('metric-tree-current')).toContainText(
        rootName
      );

      const groupResponse = await apiContext.get(
        `/api/v1/metricGroups/name/${encodeURIComponent(groupName)}`
      );
      expect(groupResponse.ok()).toBeTruthy();
      group = (await groupResponse.json()) as MetricGroupResponse;

      await page.getByRole('link', { name: 'Add Child Metric' }).click();
      await expect(page.getByTestId('metric-group-inherited')).toContainText(
        rootName
      );
      await attachScreenshot(
        page,
        'add-metric-container',
        'metric-add-child-inherited'
      );
      await fillRequiredMetricFields(page, childName);
      const childResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/api/v1/metrics')
      );
      await page.getByTestId('create-button').click();
      const child = (await (await childResponse).json()) as MetricResponse;

      expect(child.parent?.id).toBe(root.id);
      expect(child.metricGroup?.id).toBe(group.id);
      await expect(
        page.getByTestId(`metric-tree-ancestor-${root.id}`)
      ).toContainText(rootName);
      await page.getByTestId(`metric-tree-ancestor-${root.id}`).click();
      await expect(page.getByRole('heading', { name: rootName })).toBeVisible();
      await expect(
        page.getByTestId(`metric-tree-child-${child.id}`)
      ).toContainText(childName);

      await page.getByTestId('metric-definition-edit').click();
      const expression = page
        .getByTestId('metric-definition-edit-dialog')
        .getByRole('textbox', { name: 'Code' });
      await expression.fill('COUNT(DISTINCT order_id)');
      const patchResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          new URL(response.url()).pathname.endsWith(
            `/api/v1/metrics/${root?.id}`
          )
      );
      await page.getByTestId('metric-definition-save').click();
      await patchResponse;
      await expect(page.getByTestId('metric-expression-code')).toContainText(
        'COUNT(DISTINCT order_id)'
      );

      await expect(page.getByTestId('edit-metric-metadata')).toBeVisible();
      await page.getByTestId('edit-metric-metadata').click();
      await expect(
        page.getByTestId('metric-metadata-edit-dialog')
      ).toBeVisible();
      await page
        .getByTestId('metric-metadata-edit-dialog')
        .getByRole('button', { name: 'Cancel' })
        .click();

      const definitionDesktop = await page
        .getByTestId('metric-definition-card')
        .boundingBox();
      const railDesktop = await page
        .getByTestId('metric-metadata-rail')
        .boundingBox();
      expect(definitionDesktop).not.toBeNull();
      expect(railDesktop).not.toBeNull();
      expect(railDesktop?.x).toBeGreaterThan(definitionDesktop?.x ?? 0);

      await page.setViewportSize({ height: 844, width: 390 });
      const definitionNarrow = await page
        .getByTestId('metric-definition-card')
        .boundingBox();
      const railNarrow = await page
        .getByTestId('metric-metadata-rail')
        .boundingBox();
      expect(railNarrow?.width).toBeLessThanOrEqual(390);
      expect(railNarrow?.y).toBeGreaterThan(definitionNarrow?.y ?? 0);
      await attachScreenshot(
        page,
        'metric-details-page',
        'metric-overview-narrow'
      );
    } finally {
      if (root) {
        await apiContext.delete(
          `/api/v1/metrics/${root.id}?hardDelete=true&recursive=true`
        );
      }
      if (group) {
        await apiContext.delete(
          `/api/v1/metricGroups/${group.id}?hardDelete=true&recursive=true`
        );
      }
      await afterAction();
    }
  });

  test('keeps Overview metadata visible while hiding edits from read-only users', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const readOnlyUser = new UserClass();
    const readOnlyPolicy = new PolicyClass();
    const readOnlyRole = new RolesClass();
    const metricName = `pw-metric-read-only-overview-${uuid()}`;
    let metric: MetricResponse | undefined;
    let readOnlyAfterAction: (() => Promise<void>) | undefined;
    let userCreated = false;

    try {
      const adminResponse = await apiContext.get('/api/v1/users/name/admin');
      expect(adminResponse.ok()).toBeTruthy();
      const admin = (await adminResponse.json()) as EntityReferenceResponse;
      metric = await createMetric(
        apiContext,
        metricName,
        undefined,
        undefined,
        [{ id: admin.id, name: admin.name, type: 'user' }]
      );
      await setupUserWithPolicy(
        apiContext,
        readOnlyUser,
        readOnlyPolicy,
        readOnlyRole,
        VIEW_ONLY_RULE
      );
      userCreated = true;

      const readOnlySession = await performUserLogin(browser, readOnlyUser);
      readOnlyAfterAction = readOnlySession.afterAction;
      await readOnlySession.page.goto(
        `/metric/${encodeURIComponent(metric.fullyQualifiedName)}`,
        { waitUntil: 'domcontentloaded' }
      );

      const detailsPage = readOnlySession.page.getByTestId(
        'metric-details-page'
      );
      await expect(detailsPage).toBeVisible({ timeout: 60_000 });
      const detailHeader = detailsPage.getByTestId('metric-detail-header');
      await expect(detailHeader).toContainText(metric.fullyQualifiedName);
      await expect(detailHeader.getByTestId('metric-type')).toContainText(
        'Count'
      );
      await expect(
        detailsPage.getByTestId('metric-definition-unit')
      ).toContainText('Count');
      await expect(detailHeader.getByTestId('granularity')).toContainText(
        'Day'
      );
      await expect(
        detailHeader.getByTestId('metric-status-pill')
      ).toContainText('Approved');
      await expect(
        detailHeader.getByTestId('metric-header-health-pill')
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        detailsPage.getByTestId('metric-definition-edit')
      ).toHaveCount(0);
      await expect(detailsPage.getByTestId('edit-metric-metadata')).toHaveCount(
        0
      );
    } finally {
      try {
        await readOnlyAfterAction?.();
      } finally {
        try {
          if (metric) {
            await apiContext.delete(
              `/api/v1/metrics/${metric.id}?hardDelete=true&recursive=true`
            );
          }
        } finally {
          try {
            if (userCreated) {
              await readOnlyUser.delete(apiContext);
            }
          } finally {
            try {
              if (readOnlyRole.responseData?.id) {
                await readOnlyRole.delete(apiContext);
              }
            } finally {
              try {
                if (readOnlyPolicy.responseData?.id) {
                  await readOnlyPolicy.delete(apiContext);
                }
              } finally {
                await afterAction();
              }
            }
          }
        }
      }
    }
  });

  test('paginates top-level hierarchy results', async ({ browser }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const suffix = uuid();
    const metrics: MetricResponse[] = [];

    try {
      metrics.push(
        ...(await Promise.all(
          Array.from({ length: 21 }, (_, index) =>
            createMetric(
              apiContext,
              `pw-metric-page-${String(index).padStart(2, '0')}-${suffix}`
            )
          )
        ))
      );
      const firstPage = page.waitForResponse((response) =>
        response.url().includes('/api/v1/metrics/hierarchy')
      );
      await page.goto('/metrics');
      await firstPage;
      await expect(page.getByTestId('metric-page-next')).toBeVisible();

      const secondPage = page.waitForResponse((response) => {
        const url = new URL(response.url());

        return (
          url.pathname.endsWith('/api/v1/metrics/hierarchy') &&
          url.searchParams.get('offset') === '20'
        );
      });
      await page.getByTestId('metric-page-next').click();
      await secondPage;
      await expect(page.getByTestId('metric-page-previous')).toBeEnabled();
      await expect(
        page.getByRole('navigation', { name: 'Page' })
      ).toContainText('Page 2');
    } finally {
      await Promise.all(
        metrics.map(({ id }) =>
          apiContext.delete(
            `/api/v1/metrics/${id}?hardDelete=true&recursive=true`
          )
        )
      );
      await afterAction();
    }
  });

  test('creates an In Review metric through the UI when a reviewer is selected', async ({
    browser,
  }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    const reviewer = new UserClass();
    const metricName = `pw-ui-review-${uuid()}`;
    let metric: MetricResponse | undefined;

    try {
      await reviewer.create(apiContext);
      const reviewerName = reviewer.responseData.name;
      await expect
        .poll(
          async () => {
            const response = await apiContext.get(
              `/api/v1/search/query?q=${encodeURIComponent(
                reviewerName
              )}&index=user&from=0&size=10`
            );
            const data = (await response.json()) as {
              hits?: { total?: { value?: number } };
            };

            return data.hits?.total?.value ?? 0;
          },
          { timeout: 90_000 }
        )
        .toBeGreaterThan(0);

      await page.goto('/metrics/add-metric');
      await fillRequiredMetricFields(page, metricName);
      await page
        .getByRole('textbox', { name: 'Description' })
        .fill(`Metric ${metricName}`);
      const reviewerPicker = page.getByRole('group', { name: 'Reviewers' });
      await reviewerPicker.getByRole('textbox').fill(reviewerName);
      const reviewerCheckbox = reviewerPicker.getByRole('checkbox', {
        name: reviewer.responseData.displayName ?? reviewerName,
      });
      await reviewerCheckbox.focus();
      await reviewerCheckbox.press('Space');
      await expect(reviewerCheckbox).toBeChecked();

      const createResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/api/v1/metrics')
      );
      await page.getByTestId('create-button').click();
      const response = await createResponse;
      const createdMetric = (await response.json()) as MetricResponse;
      metric = createdMetric;
      expect(createdMetric.reviewers?.map(({ id }) => id)).toContain(
        reviewer.responseData.id
      );

      await expect
        .poll(
          async () => {
            const response = await apiContext.get(
              `/api/v1/metrics/${createdMetric.id}`
            );
            if (!response.ok()) {
              return undefined;
            }

            return ((await response.json()) as MetricResponse).entityStatus;
          },
          {
            intervals: [1_000, 2_000, 5_000],
            timeout: 120_000,
          }
        )
        .toBe('In Review');

      await expect(page.getByTestId('metric-details-page')).toBeVisible({
        timeout: 60_000,
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('metric-status-pill')).toContainText(
        'In Review',
        { timeout: 60_000 }
      );
    } finally {
      if (metric) {
        await apiContext.delete(
          `/api/v1/metrics/${metric.id}?hardDelete=true&recursive=true`
        );
      }
      await reviewer.delete(apiContext);
      await afterAction();
    }
  });

  test('refuses to delete a parent without recursive, then succeeds with it', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const suffix = uuid();
    const parentName = `pw-metric-del-${suffix}`;
    const childName = `pw-metric-delkid-${suffix}`;

    try {
      const parent = await createMetric(apiContext, parentName);
      await createMetric(apiContext, childName, parentName);

      const blocked = await apiContext.delete(
        `/api/v1/metrics/${parent.id}?hardDelete=true`
      );

      expect(blocked.status()).toBe(400);

      const allowed = await apiContext.delete(
        `/api/v1/metrics/${parent.id}?hardDelete=true&recursive=true`
      );

      expect(allowed.ok()).toBeTruthy();
    } finally {
      await afterAction();
    }
  });
});
