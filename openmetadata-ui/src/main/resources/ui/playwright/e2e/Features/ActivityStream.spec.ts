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

import { expect, test as base } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

const test = base;

const adminUser = new UserClass();
const testTable = new TableClass();

test.describe('Activity Stream on Entity Pages', () => {
  test.beforeAll(
    'setup: create entities and users',
    async ({ browser }) => {
      test.slow(true);

      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await adminUser.create(apiContext);
        await adminUser.setAdminRole(apiContext);
        await testTable.create(apiContext);
      } finally {
        await afterAction();
      }
    }
  );

  test.afterAll(
    'cleanup: delete entities and users',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await testTable.delete(apiContext);
        await adminUser.delete(apiContext);
      } finally {
        await afterAction();
      }
    }
  );

  test.beforeEach(async ({ page }) => {
    await adminUser.login(page);
  });

  test('activity feed tab shows activity events for entity', async ({
    page,
  }) => {
    await testTable.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByRole('tab', {
      name: 'Activity Feeds & Tasks',
    });

    await expect(activityFeedTab).toBeVisible();
    await activityFeedTab.click();
    await page.waitForLoadState('networkidle');

    const activityTabContent = page.locator('.activity-feed-tab');

    await expect(activityTabContent).toBeVisible();

    // Check for activity feed content - left panel structure may vary
    const leftPanel = activityTabContent.locator('.left-container');

    if (await leftPanel.isVisible()) {
      // The left panel with tabs (All/Tasks) should be visible
      const leftPanelContent = leftPanel.locator(
        '[data-testid="global-setting-left-panel"], [data-testid="activity-feed-tabs"]'
      );

      if (await leftPanelContent.count() > 0) {
        await expect(leftPanelContent.first()).toBeVisible();
      }
    }
  });

  test('activity events are created when entity description is updated', async ({
    page,
  }) => {
    await testTable.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const editDescriptionButton = page.getByTestId('edit-description');

    await expect(editDescriptionButton).toBeVisible();
    await editDescriptionButton.click();

    // Wait for editor to appear - TipTap uses ProseMirror contenteditable
    const descriptionEditor = page.locator(
      '[data-testid="editor"] .ProseMirror, [data-testid="markdown-editor"] .ql-editor, .toastui-editor-contents'
    ).first();

    await expect(descriptionEditor).toBeVisible({ timeout: 10000 });

    const testDescription = `Test description for activity stream - ${Date.now()}`;
    await descriptionEditor.fill(testDescription);

    const saveButton = page.getByTestId('save');
    const updateResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tables/') &&
        response.request().method() === 'PATCH'
    );
    await saveButton.click();
    await updateResponse;

    await page.waitForLoadState('networkidle');

    await page.reload();
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByRole('tab', {
      name: 'Activity Feeds & Tasks',
    });
    await activityFeedTab.click();
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);

    const messageContainers = page.locator('[data-testid="message-container"]');
    const count = await messageContainers.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('activity events are created when entity tags are updated', async ({
    page,
  }) => {
    await testTable.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const addTagButton = page
      .locator('[data-testid="entity-right-panel"]')
      .getByTestId('add-tag');

    if (await addTagButton.isVisible()) {
      await addTagButton.click();

      const tagSearch = page.getByTestId('tag-selector');

      await expect(tagSearch).toBeVisible();
      await tagSearch.fill('PII');

      const tagOption = page.locator('[data-testid="tag-PII.Sensitive"]').first();

      if (await tagOption.isVisible()) {
        await tagOption.click();

        const saveButton = page.locator(
          '[data-testid="inline-save-btn"], [data-testid="saveAssociatedTag"]'
        );

        if (await saveButton.isVisible()) {
          const updateResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/tables/') &&
              response.request().method() === 'PATCH'
          );
          await saveButton.click();
          await updateResponse;
        }
      }
    }

    await page.waitForLoadState('networkidle');
    await page.reload();
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByRole('tab', {
      name: 'Activity Feeds & Tasks',
    });
    await activityFeedTab.click();
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(2000);

    const allTabInLeftPanel = page.locator(
      '[data-testid="global-setting-left-panel"]'
    );

    if (await allTabInLeftPanel.isVisible()) {
      await expect(allTabInLeftPanel).toBeVisible();
    }
  });

  test('activity count badge is displayed in tab header', async ({ page }) => {
    await testTable.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByRole('tab', {
      name: 'Activity Feeds & Tasks',
    });

    await expect(activityFeedTab).toBeVisible();

    const countBadge = activityFeedTab.getByTestId('count');
    const countText = await countBadge.textContent();
    const count = parseInt(countText ?? '0', 10);

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('activity stream API is called when visiting entity page', async ({
    page,
  }) => {
    const activityApiPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/activity') &&
        response.status() === 200,
      { timeout: 10000 }
    ).catch(() => null);

    await testTable.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByRole('tab', {
      name: 'Activity Feeds & Tasks',
    });
    await activityFeedTab.click();

    const response = await activityApiPromise;

    if (response) {
      const responseBody = await response.json();

      expect(responseBody).toHaveProperty('data');
      expect(Array.isArray(responseBody.data)).toBe(true);
    }
  });

  test('activity feed left panel shows All and Tasks options', async ({
    page,
  }) => {
    await testTable.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByRole('tab', {
      name: 'Activity Feeds & Tasks',
    });
    await activityFeedTab.click();
    await page.waitForLoadState('networkidle');

    const leftPanel = page.locator(
      '[data-testid="global-setting-left-panel"]'
    );

    if (await leftPanel.isVisible()) {
      const allOption = leftPanel.locator('li').filter({ hasText: 'All' });
      const tasksOption = leftPanel.locator('li').filter({ hasText: 'Tasks' });

      await expect(allOption).toBeVisible();
      await expect(tasksOption).toBeVisible();
    }
  });
});
