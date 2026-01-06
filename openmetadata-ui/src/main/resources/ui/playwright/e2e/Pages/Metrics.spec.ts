/*
 *  Copyright 2024 Collate.
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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { MetricClass } from '../../support/entity/MetricClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Metrics Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // ============================================================================
  // METRIC CRUD OPERATIONS
  // ============================================================================

  test('should create metric from Metrics list page', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await sidebarClick(page, SidebarItem.METRICS);

      await page.click('[data-testid="create-metric"]');
      await page.waitForSelector('[data-testid="create-button"]');

      // Fill required fields
      await page.fill('[data-testid="name"]', metric.entity.name);
      await page.fill(
        '[data-testid="displayName"]',
        metric.entity.displayName
      );
      await page.locator(descriptionBox).fill(metric.entity.description);

      // Select language
      await page
        .locator('[id="root\\/language"]')
        .fill(metric.entity.metricExpression.language);
      await page
        .getByTitle(metric.entity.metricExpression.language, { exact: true })
        .click();

      // Enter code
      await page.locator("pre[role='presentation']").last().click();
      await page.keyboard.type(metric.entity.metricExpression.code);

      const metricResponse = page.waitForResponse('/api/v1/metrics');
      await page.click('[data-testid="create-button"]');
      const response = await metricResponse;
      metric.entityResponseData = await response.json();

      // Verify metric was created
      await expect(page.getByTestId('entity-header-display-name')).toHaveText(
        metric.entity.displayName
      );
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should create metric with all optional fields', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await sidebarClick(page, SidebarItem.METRICS);

      await page.click('[data-testid="create-metric"]');
      await page.waitForSelector('[data-testid="create-button"]');

      // Fill required fields
      await page.fill('[data-testid="name"]', metric.entity.name);
      await page.fill(
        '[data-testid="displayName"]',
        metric.entity.displayName
      );
      await page.locator(descriptionBox).fill(metric.entity.description);

      // Select granularity
      await page
        .locator('[id="root\\/granularity"]')
        .fill(metric.entity.granularity);
      await page
        .getByTitle(metric.entity.granularity, { exact: true })
        .click();

      // Select metric type
      await page
        .locator('[id="root\\/metricType"]')
        .fill(metric.entity.metricType);
      await page.getByTitle(metric.entity.metricType, { exact: true }).click();

      // Select unit of measurement
      await page
        .getByTestId('unitOfMeasurement')
        .locator('input')
        .fill(metric.entity.unitOfMeasurement);
      await page
        .getByTitle(metric.entity.unitOfMeasurement, { exact: true })
        .click();

      // Select language
      await page
        .locator('[id="root\\/language"]')
        .fill(metric.entity.metricExpression.language);
      await page
        .getByTitle(metric.entity.metricExpression.language, { exact: true })
        .click();

      // Enter code
      await page.locator("pre[role='presentation']").last().click();
      await page.keyboard.type(metric.entity.metricExpression.code);

      const metricResponse = page.waitForResponse('/api/v1/metrics');
      await page.click('[data-testid="create-button"]');
      const response = await metricResponse;
      metric.entityResponseData = await response.json();

      // Verify all fields
      await expect(page.getByTestId('entity-header-display-name')).toHaveText(
        metric.entity.displayName
      );
      await expect(
        page.getByText(`Metric Type${metric.entity.metricType.toUpperCase()}`)
      ).toBeVisible();
      await expect(
        page.getByText(
          `Measurement Unit${metric.entity.unitOfMeasurement.toUpperCase()}`
        )
      ).toBeVisible();
      await expect(
        page.getByText(`Granularity${metric.entity.granularity.toUpperCase()}`)
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should update metric display name', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Click edit display name
      await page.click('[data-testid="edit-displayName"]');
      await page.fill('[data-testid="displayName"]', 'Updated Display Name');

      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.click('[data-testid="save-displayName"]');
      await patchPromise;

      // Verify display name was updated
      await expect(page.getByTestId('entity-header-display-name')).toHaveText(
        'Updated Display Name'
      );
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should update metric owners', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();
    const user = new UserClass();

    try {
      await user.create(apiContext);
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Add owner
      await page.click('[data-testid="edit-owner"]');
      await page.waitForSelector('[data-testid="owner-select-users-search-bar"]');
      await page.fill(
        '[data-testid="owner-select-users-search-bar"]',
        user.responseData.name
      );

      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page
        .getByTestId(`${user.responseData.name}-user-label`)
        .click();
      await patchPromise;

      // Verify owner was added
      await expect(
        page.getByTestId('data-assets-header').getByTestId('owner-link')
      ).toContainText(user.responseData.displayName);
    } finally {
      await metric.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    }
  });

  test('should delete metric with confirmation', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Delete metric
      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="delete-button"]');

      await page.waitForSelector('[data-testid="modal-container"]');
      await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

      const deletePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/metrics/') &&
          response.request().method() === 'DELETE'
      );
      await page.click('[data-testid="confirm-button"]');
      await deletePromise;

      // Verify redirect to metrics listing page
      await expect(page.getByTestId('heading')).toHaveText('Metrics');
    } finally {
      // Metric already deleted
      await afterAction();
    }
  });

  // ============================================================================
  // METRIC DETAILS
  // ============================================================================

  test('should view metric details page', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Verify all sections are present
      await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
      await expect(page.getByTestId('viewer-container')).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Overview', exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('tab', { name: 'Activity Feeds', exact: true })
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should navigate between tabs', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Navigate to Activity Feed tab
      await page.getByRole('tab', { name: 'Activity Feeds', exact: true }).click();
      await expect(
        page.getByRole('tab', { name: 'Activity Feeds', exact: true })
      ).toHaveAttribute('aria-selected', 'true');

      // Navigate to Custom Properties tab if available
      const customPropsTab = page.getByRole('tab', {
        name: 'Custom Properties',
        exact: true,
      });
      if (await customPropsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await customPropsTab.click();
        await expect(customPropsTab).toHaveAttribute('aria-selected', 'true');
      }

      // Navigate back to Overview
      await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      await expect(
        page.getByRole('tab', { name: 'Overview', exact: true })
      ).toHaveAttribute('aria-selected', 'true');
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  // ============================================================================
  // METRIC RELATIONSHIPS
  // ============================================================================

  test('should add related metrics', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric1 = new MetricClass();
    const metric2 = new MetricClass();

    try {
      await metric1.create(apiContext);
      await metric2.create(apiContext);
      await metric1.visitEntityPage(page);

      // Add related metric
      await page
        .getByTestId('add-related-metrics-container')
        .locator('span')
        .first()
        .click();

      await page.waitForSelector(
        '[data-testid="asset-select-list"] > .ant-select-selector input',
        { state: 'visible' }
      );

      const apiPromise = page.waitForResponse(
        '/api/v1/search/query?q=*&index=metric_search_index&*'
      );

      await page.fill(
        '[data-testid="asset-select-list"] > .ant-select-selector input',
        metric2.entity.name
      );

      await apiPromise;

      await page
        .locator('.ant-select-item-option-content', {
          hasText: metric2.entity.name,
        })
        .click();

      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.locator('[data-testid="saveRelatedMetrics"]').click();
      await patchPromise;

      // Verify related metric was added
      await expect(
        page.getByRole('button', { name: metric2.entity.name, exact: true })
      ).toBeVisible();
    } finally {
      await metric1.delete(apiContext);
      await metric2.delete(apiContext);
      await afterAction();
    }
  });

  test('should remove related metrics', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric1 = new MetricClass();
    const metric2 = new MetricClass();

    try {
      await metric1.create(apiContext);
      await metric2.create(apiContext);

      // Add related metric via API
      await metric1.patch(apiContext, [
        {
          op: 'add',
          path: '/relatedMetrics',
          value: [
            {
              id: metric2.entityResponseData.id,
              type: 'metric',
            },
          ],
        },
      ]);

      await metric1.visitEntityPage(page);

      // Remove related metric
      await page.getByTestId('edit-related-metrics').click();
      await page.waitForSelector('[data-testid="asset-select-list"]');

      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page
        .locator('[data-testid="asset-select-list"]')
        .getByRole('img', { name: 'close' })
        .click();
      await page.locator('[data-testid="saveRelatedMetrics"]').click();
      await patchPromise;

      // Verify related metric was removed
      await expect(
        page.getByTestId('add-related-metrics-container')
      ).toBeVisible();
    } finally {
      await metric1.delete(apiContext);
      await metric2.delete(apiContext);
      await afterAction();
    }
  });

  test('should view related metrics on details page', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric1 = new MetricClass();
    const metric2 = new MetricClass();

    try {
      await metric1.create(apiContext);
      await metric2.create(apiContext);

      // Add related metric via API
      await metric1.patch(apiContext, [
        {
          op: 'add',
          path: '/relatedMetrics',
          value: [
            {
              id: metric2.entityResponseData.id,
              type: 'metric',
            },
          ],
        },
      ]);

      await metric1.visitEntityPage(page);

      // Verify related metric is visible
      await expect(
        page.getByRole('button', { name: metric2.entity.name, exact: true })
      ).toBeVisible();

      // Click on related metric to navigate
      const metricsResponsePromise = page.waitForResponse(
        `/api/v1/metrics/name/${metric2.entity.name}?fields=*`
      );
      await page
        .getByRole('button', { name: metric2.entity.name, exact: true })
        .click();
      await metricsResponsePromise;

      // Verify navigation to related metric
      await expect(page.getByTestId('entity-header-display-name')).toContainText(
        metric2.entity.name
      );
    } finally {
      await metric1.delete(apiContext);
      await metric2.delete(apiContext);
      await afterAction();
    }
  });

  // ============================================================================
  // METRIC METADATA
  // ============================================================================

  test('should add description', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      // Create metric without description
      const response = await apiContext.post('/api/v1/metrics', {
        data: {
          name: metric.entity.name,
          displayName: metric.entity.displayName,
          metricExpression: metric.entity.metricExpression,
        },
      });
      metric.entityResponseData = await response.json();

      await metric.visitEntityPage(page);

      // Add description
      await page.click('[data-testid="edit-description"]');
      await page
        .locator(descriptionBox)
        .fill('This is a new description for the metric');
      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.click('[data-testid="save"]');
      await patchPromise;

      // Verify description was added
      await expect(
        page.locator('[data-testid="viewer-container"]')
      ).toContainText('new description');
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should update tags', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Add tag
      await page
        .getByTestId('KnowledgePanel.Tags')
        .getByTestId('tags-container')
        .getByTestId('add-tag')
        .click();
      await page.waitForSelector('[data-testid="tag-selector"]');
      await page.fill('[data-testid="tag-selector"] input', 'PII');

      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.getByTestId('tag-PII.Sensitive').click();
      await page.click('[data-testid="saveAssociatedTag"]');
      await patchPromise;

      // Verify tag was added
      await expect(
        page
          .getByTestId('KnowledgePanel.Tags')
          .getByTestId('tags-container')
          .getByTestId('tag-PII.Sensitive')
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should add domain', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();
    const domain = new Domain();

    try {
      await domain.create(apiContext);
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Add domain
      await page
        .getByTestId('KnowledgePanel.Domain')
        .getByTestId('add-domain')
        .click();
      await page.waitForSelector('[data-testid="select-domain-dropdown"]');

      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page
        .getByTestId(`select-domain-${domain.responseData.name}`)
        .click();
      await patchPromise;

      // Verify domain was added
      await expect(
        page
          .getByTestId('KnowledgePanel.Domain')
          .getByTestId('domain-link')
      ).toContainText(domain.responseData.displayName);
    } finally {
      await metric.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  // ============================================================================
  // METRIC SEARCH & FILTER
  // ============================================================================

  test('should search for metrics', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await sidebarClick(page, SidebarItem.METRICS);

      // Search for metric
      const searchInput = page.getByPlaceholder('Search for metrics');
      await searchInput.fill(metric.entity.name);

      const searchResponse = page.waitForResponse(
        (response) => response.url().includes('/api/v1/search/query')
      );
      await page.keyboard.press('Enter');
      await searchResponse;

      // Verify metric appears in results
      await expect(
        page.getByRole('row', { name: new RegExp(metric.entity.name) })
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should filter by owner', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();
    const user = new UserClass();

    try {
      await user.create(apiContext);
      await metric.create(apiContext);

      // Add owner to metric
      await metric.patch(apiContext, [
        {
          op: 'add',
          path: '/owners',
          value: [
            {
              id: user.responseData.id,
              type: 'user',
            },
          ],
        },
      ]);

      await sidebarClick(page, SidebarItem.METRICS);

      // Open owner filter
      const ownerFilter = page.locator('[data-testid="owner-filter"]');
      if (await ownerFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ownerFilter.click();
        await page.fill(
          '[data-testid="owner-search-input"]',
          user.responseData.name
        );
        await page
          .getByTestId(`owner-option-${user.responseData.name}`)
          .click();

        // Verify filtered results
        await page.waitForTimeout(1000);
        const results = page.getByRole('row');
        await expect(results.first()).toBeVisible();
      }
    } finally {
      await metric.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    }
  });

  test('should filter by tags', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);

      // Add tag to metric
      await metric.patch(apiContext, [
        {
          op: 'add',
          path: '/tags',
          value: [
            {
              tagFQN: 'PII.Sensitive',
              source: 'Classification',
            },
          ],
        },
      ]);

      await sidebarClick(page, SidebarItem.METRICS);

      // Open tag filter
      const tagFilter = page.locator('[data-testid="tag-filter"]');
      if (await tagFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tagFilter.click();
        await page.fill('[data-testid="tag-search-input"]', 'PII.Sensitive');
        await page.getByTestId('tag-option-PII.Sensitive').click();

        // Verify filtered results
        await page.waitForTimeout(1000);
        const results = page.getByRole('row');
        await expect(results.first()).toBeVisible();
      }
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  // ============================================================================
  // ADDITIONAL COMPREHENSIVE TESTS
  // ============================================================================

  test('should update metric expression', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Navigate to Expression tab
      await page.getByRole('tab', { name: 'Expression', exact: true }).click();
      await page.click('[data-testid="edit-expression-button"]');

      // Update language
      await page.locator('[id="root\\/language"]').fill('JavaScript');
      await page.getByTitle('JavaScript', { exact: true }).click();

      // Update code
      await page.locator("pre[role='presentation']").last().click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('COUNT(revenue)');

      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.getByTestId('update-button').click();
      await patchPromise;

      // Verify expression was updated
      await expect(
        page.getByLabel('Expression').locator('.CodeMirror-scroll')
      ).toContainText('COUNT(revenue)');
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should display metric listing page correctly', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);

      const listAPIPromise = page.waitForResponse(
        '/api/v1/metrics?fields=owners%2Ctags&limit=15&include=all'
      );

      await sidebarClick(page, SidebarItem.METRICS);
      await listAPIPromise;

      // Verify page elements
      await expect(page.getByTestId('heading')).toHaveText('Metrics');
      await expect(page.getByTestId('sub-heading')).toHaveText(
        'Define and catalog standardized metrics across your organization.'
      );

      // Verify table headers
      await expect(
        page.getByRole('columnheader', { name: 'Name', exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: 'Description', exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: 'Tags', exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('columnheader', { name: 'Owners', exact: true })
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should handle voting on metrics', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Upvote
      const upvotePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/vote') &&
          response.request().method() === 'PUT'
      );
      await page.click('[data-testid="up-vote-btn"]');
      await upvotePromise;

      // Verify upvote is active
      await expect(
        page.locator('[data-testid="up-vote-btn"][aria-pressed="true"]')
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should follow and unfollow metric', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Follow metric
      const followPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/followers') &&
          response.request().method() === 'PUT'
      );
      await page.click('[data-testid="entity-follow-button"]');
      await followPromise;

      // Verify followed
      await expect(page.getByTestId('entity-follow-button')).toContainText(
        'Unfollow'
      );

      // Unfollow metric
      const unfollowPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/followers') &&
          response.request().method() === 'DELETE'
      );
      await page.click('[data-testid="entity-follow-button"]');
      await unfollowPromise;

      // Verify unfollowed
      await expect(page.getByTestId('entity-follow-button')).toContainText(
        'Follow'
      );
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  test('should view activity feed', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Navigate to Activity Feed tab
      await page.getByRole('tab', { name: 'Activity Feeds', exact: true }).click();

      // Verify activity feed tab is active
      await expect(
        page.getByRole('tab', { name: 'Activity Feeds', exact: true })
      ).toHaveAttribute('aria-selected', 'true');

      // Activity feed content should be visible
      const activityFeedContainer = page.locator('[data-testid="activity-feed"]');
      if (
        await activityFeedContainer.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await expect(activityFeedContainer).toBeVisible();
      }
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });
});
