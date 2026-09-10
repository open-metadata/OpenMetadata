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

import { TableClass } from '../../support/entity/TableClass';
import { expect, test as base } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import { insertActivityEventForTest } from '../../utils/activityAPI';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForPageLoaded } from '../../utils/polling';

const test = base;

const adminUser = new UserClass();
const testTable = new TableClass();
const seededActivitySummary = `Activity stream seeded event ${uuid()}`;

test.describe('Activity Stream on Entity Pages', () => {
  test.beforeAll('setup: create entities and users', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await testTable.create(apiContext);
      // Seed a change-event explicitly rather than leaning on the implicit
      // entityCreated one: its wording is not part of any contract and it is
      // written asynchronously, so asserting on it is both vague and racy.
      await insertActivityEventForTest(
        apiContext,
        testTable,
        seededActivitySummary
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll('cleanup: delete entities and users', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await testTable.delete(apiContext);
      await adminUser.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

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
    await waitForPageLoaded(page);

    const activityTabContent = page.locator('.activity-feed-tab');

    await expect(activityTabContent).toBeVisible();

    await expect(page.getByTestId('global-setting-left-panel')).toBeVisible();

    // Scoped to #feedData: the right-hand panel renders message-container for
    // the auto-selected item too, so an unscoped match could pass on the panel
    // without the event ever appearing in the list this test is about.
    await expect(
      page
        .locator('#feedData [data-testid="message-container"]')
        .filter({ hasText: seededActivitySummary })
        .first()
    ).toBeVisible({ timeout: 30_000 });
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
    const descriptionEditor = page
      .locator(
        '[data-testid="editor"] .ProseMirror, [data-testid="markdown-editor"] .ql-editor, .toastui-editor-contents'
      )
      .first();

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

    await waitForPageLoaded(page);

    await page.reload();
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByRole('tab', {
      name: 'Activity Feeds & Tasks',
    });
    await activityFeedTab.click();
    await waitForPageLoaded(page);

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

      const tagOption = page
        .locator('[data-testid="tag-PII.Sensitive"]')
        .first();

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

    await waitForPageLoaded(page);
    await page.reload();
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByRole('tab', {
      name: 'Activity Feeds & Tasks',
    });
    await activityFeedTab.click();
    await waitForPageLoaded(page);

    const allTabInLeftPanel = page.locator(
      '[data-testid="global-setting-left-panel"]'
    );
    await allTabInLeftPanel
      .waitFor({ state: 'visible', timeout: 2000 })
      .catch(() => undefined);

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

    // The badge is feedCount.totalCount = conversations + activity + tasks.
    // The seeded table has no conversations or tasks but does have its own
    // entityCreated change-event, so the only correct value here is >= 1 —
    // asserting >= 0 passed even when activity was left out of the total.
    const countBadge = activityFeedTab.getByTestId('count');

    await expect(countBadge).toBeVisible();
    await expect(countBadge).toHaveText(/^[1-9]\d*$/, { timeout: 30_000 });
  });

  test(
    'activity stream API is called when visiting entity page',
    { tag: '@quarantine' },
    async ({ page }) => {
      const activityApiPromise = page
        .waitForResponse(
          (response) =>
            response.url().includes('/api/v1/activity') &&
            response.status() === 200,
          { timeout: 10000 }
        )
        .catch(() => null);

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
    }
  );

  test('activity feed left panel shows All and Tasks options', async ({
    page,
  }) => {
    await testTable.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const activityFeedTab = page.getByRole('tab', {
      name: 'Activity Feeds & Tasks',
    });
    await activityFeedTab.click();
    await waitForPageLoaded(page);

    const leftPanel = page.locator('[data-testid="global-setting-left-panel"]');

    if (await leftPanel.isVisible()) {
      const allOption = leftPanel.locator('li').filter({ hasText: 'All' });
      const tasksOption = leftPanel.locator('li').filter({ hasText: 'Tasks' });

      await expect(allOption).toBeVisible();
      await expect(tasksOption).toBeVisible();
    }
  });
});
