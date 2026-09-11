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
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import {
  ACTIVITY_TEST_TIMEOUT,
  getTableFqn,
  insertActivityEventForTest,
  visitTableActivityFeed,
  waitForActivityEvent,
} from '../../utils/activityAPI';
import { performAdminLogin } from '../../utils/admin';
import { getDescriptionBox, uuid } from '../../utils/common';
import { assignTag, waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForPageLoaded } from '../../utils/polling';

const test = base;

const adminUser = new UserClass();
const testTable = new TableClass();
const classification = new ClassificationClass();
const tag = new TagClass({ classification: classification.data.name });
const seededActivitySummary = `Activity stream seeded event ${uuid()}`;

test.describe('Activity Stream on Entity Pages', () => {
  test.beforeAll('setup: create entities and users', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await testTable.create(apiContext);
      await classification.create(apiContext);
      await tag.create(apiContext);
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
      await classification.delete(apiContext);
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
    ).toBeVisible({ timeout: 30_000 });
  });

  test('activity events are created when entity description is updated', async ({
    page,
  }) => {
    test.setTimeout(ACTIVITY_TEST_TIMEOUT);
    await testTable.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    const editDescriptionButton = page.getByTestId('edit-description');

    await expect(editDescriptionButton).toBeVisible();
    await editDescriptionButton.click();

    const descriptionEditor = getDescriptionBox(page);

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
    expect((await updateResponse).status()).toBe(200);

    await waitForActivityEvent({
      entityFqn: getTableFqn(testTable),
      eventType: 'DescriptionUpdated',
      text: testDescription,
    });
    await visitTableActivityFeed(page, testTable);
    await expect(
      page.locator('#feedData').getByTestId('message-container').filter({
        hasText: testDescription,
      })
    ).toBeVisible();
  });

  test('activity events are created when entity tags are updated', async ({
    page,
  }) => {
    test.setTimeout(ACTIVITY_TEST_TIMEOUT);
    await testTable.visitEntityPage(page);
    await assignTag(
      page,
      tag.data.name,
      'Add',
      'tables',
      'KnowledgePanel.Tags',
      tag.responseData.fullyQualifiedName
    );
    await waitForActivityEvent({
      entityFqn: getTableFqn(testTable),
      eventType: 'TagsUpdated',
      text: tag.responseData.fullyQualifiedName,
    });
    await visitTableActivityFeed(page, testTable);
    await expect(
      page.locator('#feedData').getByTestId('message-container').filter({
        hasText: tag.data.displayName,
      })
    ).toBeVisible();
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

  test('activity stream API is called when visiting entity page', async ({
    page,
  }) => {
    const responseBody = await visitTableActivityFeed(page, testTable);

    expect(responseBody).toHaveProperty('data');
    expect(responseBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ summary: seededActivitySummary }),
      ])
    );
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
    await waitForPageLoaded(page);

    const leftPanel = page.locator('[data-testid="global-setting-left-panel"]');

    await expect(leftPanel).toBeVisible();
    await expect(
      leftPanel.getByRole('menuitem', { name: /^All/ })
    ).toBeVisible();
    await expect(
      leftPanel.getByRole('menuitem', { name: /^Tasks/ })
    ).toBeVisible();
  });
});
