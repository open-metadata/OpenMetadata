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
import { SidebarItem } from '../../../constant/sidebar';
import { MetricClass } from '../../../support/entity/MetricClass';
import { UserClass } from '../../../support/user/UserClass';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../../utils/common';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Metrics P2 Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // M-C01: Create metric with all required fields (name, description, formula)
  test('should create metric with all required fields', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await redirectToHomePage(page);
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

      // Select language for expression
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

  // M-C02: Create metric with special characters in name
  test('should create metric with special characters in name', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();
    const specialName = `Test_Metric-${Date.now()}`;

    try {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.METRICS);

      await page.click('[data-testid="create-metric"]');
      await page.waitForSelector('[data-testid="create-button"]');

      // Use name with underscores and hyphens
      await page.fill('[data-testid="name"]', specialName);
      await page.fill('[data-testid="displayName"]', specialName);
      await page
        .locator(descriptionBox)
        .fill('Metric with special characters');

      // Select language
      await page.locator('[id="root\\/language"]').fill('SQL');
      await page.getByTitle('SQL', { exact: true }).click();

      // Enter code
      await page.locator("pre[role='presentation']").last().click();
      await page.keyboard.type('COUNT(*)');

      const metricResponse = page.waitForResponse('/api/v1/metrics');
      await page.click('[data-testid="create-button"]');
      const response = await metricResponse;
      metric.entityResponseData = await response.json();

      // Verify metric was created
      await expect(page.getByTestId('entity-header-name')).toHaveText(
        specialName
      );
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  // M-C03: Edit metric details (description, formula, unit of measurement)
  test('should edit metric details', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Edit description
      await page.click('[data-testid="edit-description"]');
      await page
        .locator(descriptionBox)
        .fill('Updated metric description for testing');
      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.click('[data-testid="save"]');
      await patchPromise;

      // Verify description was updated
      await expect(
        page.locator('[data-testid="viewer-container"]')
      ).toContainText('Updated metric description');
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  // M-C04: Update metric unit of measurement (Percentage, Dollars, Count, etc.)
  test('should update metric unit of measurement', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Update unit of measurement
      await page.click('[data-testid="edit-measurement-unit-button"]');
      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.getByRole('listitem', { name: 'Percentage', exact: true }).click();
      await patchPromise;

      // Verify unit of measurement was updated
      await expect(
        page.getByText('Measurement UnitPERCENTAGE')
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  // M-C05: Update metric granularity settings
  test('should update metric granularity settings', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);
      await metric.visitEntityPage(page);

      // Update granularity
      await page.click('[data-testid="edit-granularity-button"]');
      const patchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.getByRole('listitem', { name: 'Month', exact: true }).click();
      await patchPromise;

      // Verify granularity was updated
      await expect(page.getByText('GranularityMONTH')).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  // M-C06: Add and remove related metrics
  test('should add and remove related metrics', async ({ page }) => {
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

      // Remove related metric
      await page.getByTestId('edit-related-metrics').click();
      await page.waitForSelector('[data-testid="asset-select-list"]');

      const removePatchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page
        .locator('[data-testid="asset-select-list"]')
        .getByRole('img', { name: 'close' })
        .click();
      await page.locator('[data-testid="saveRelatedMetrics"]').click();
      await removePatchPromise;

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

  // M-C07: Update metric owners (single and multiple)
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

      // Remove owner
      await page.click('[data-testid="edit-owner"]');
      await page.waitForSelector('[data-testid="remove-owner"]');

      const removePatchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.click('[data-testid="remove-owner"]');
      await removePatchPromise;

      // Verify owner was removed
      await expect(
        page.getByTestId('data-assets-header').getByText('No Owner')
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await user.delete(apiContext);
      await afterAction();
    }
  });

  // M-C08: Add and remove tags from metric
  test('should add and remove tags from metric', async ({ page }) => {
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

      // Remove tag
      await page
        .getByTestId('KnowledgePanel.Tags')
        .getByTestId('tags-container')
        .getByTestId('edit-button')
        .click();
      await page.waitForSelector('[data-testid="remove-tags"]');

      const removePatchPromise = page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      );
      await page.getByTestId('remove-tags').first().click();
      await page.click('[data-testid="saveAssociatedTag"]');
      await removePatchPromise;

      // Verify tag was removed
      await expect(
        page
          .getByTestId('KnowledgePanel.Tags')
          .getByTestId('tags-container')
          .getByTestId('add-tag')
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  // M-C09: Delete metric
  test('should delete metric', async ({ page }) => {
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
      // Metric already deleted, no cleanup needed
      await afterAction();
    }
  });

  // M-C10: Follow and unfollow metric
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

  // M-C11: Vote on metrics (upvote, downvote, remove vote)
  test('should vote on metrics', async ({ page }) => {
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

      // Verify upvote
      await expect(
        page.locator('[data-testid="up-vote-btn"][aria-pressed="true"]')
      ).toBeVisible();

      // Remove upvote (click again)
      const removeUpvotePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/vote') &&
          response.request().method() === 'PUT'
      );
      await page.click('[data-testid="up-vote-btn"]');
      await removeUpvotePromise;

      // Downvote
      const downvotePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/vote') &&
          response.request().method() === 'PUT'
      );
      await page.click('[data-testid="down-vote-btn"]');
      await downvotePromise;

      // Verify downvote
      await expect(
        page.locator('[data-testid="down-vote-btn"][aria-pressed="true"]')
      ).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });

  // M-C12: View metric version history
  test('should view metric version history', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const metric = new MetricClass();

    try {
      await metric.create(apiContext);

      // Make a change to create version history
      await metric.patch(apiContext, [
        {
          op: 'replace',
          path: '/description',
          value: 'Updated description for version history',
        },
      ]);

      await metric.visitEntityPage(page);

      // Click version button
      await page.click('[data-testid="version-button"]');

      // Verify version history page loaded
      await expect(page.getByTestId('version-list')).toBeVisible();
      await expect(page.locator('.version-data')).toBeVisible();
    } finally {
      await metric.delete(apiContext);
      await afterAction();
    }
  });
});
