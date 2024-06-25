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
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { clickOnLogo } from '../../utils/sidebar';
import { createDescriptionTask, createTagTask } from '../../utils/task';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const entity = new TableClass();

test.describe('Activity feed', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await entity.create(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit on landing page', async ({ page }) => {
    await redirectToHomePage(page);
    await entity.visitEntityPage(page);
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await entity.delete(apiContext);
    await afterAction();
  });

  test('Assigned task should appear to task tab', async ({ page }) => {
    const value = {
      term: entity.entity.name,
      displayName: entity.entity.name,
      entity: entity.type,
      serviceName: entity.service.name,
      entityType: entity.type,
      assignee: 'admin',
    };

    await page.getByTestId('request-description').click();

    // create description task
    await createDescriptionTask(page, value);

    await page.getByTestId('schema').click();

    page.getByTestId('request-entity-tags').click();

    // create tag task
    await createTagTask(page, { ...value, tag: 'PII.None' });

    await clickOnLogo(page);

    const taskResponse = page.waitForResponse(
      '/api/v1/feed?type=Task&filterType=OWNER&taskStatus=Open&userId=*'
    );

    await page.getByTestId('activity-feed-widget').getByText('Tasks').click();

    await taskResponse;

    await expect(
      page.locator(
        '[data-testid="activity-feed-widget"] [data-testid="no-data-placeholder"]'
      )
    ).not.toBeVisible();

    const entityPageTaskTab = page.waitForResponse('/api/v1/feed?*&type=Task');

    const tagsTask = page.getByTestId('redirect-task-button-link').first();
    const tagsTaskContent = await tagsTask.innerText();
    const isTagTaskMatch = tagsTaskContent.match(
      new RegExp(/\nRequest tags for\n/)
    );

    expect(isTagTaskMatch).not.toBeNull();

    await tagsTask.click();

    await entityPageTaskTab;

    // Task 1 - Request Tag right panel check
    const firstTaskContent = await page.getByTestId('task-title').innerText();

    const firstMatch = firstTaskContent.match(
      new RegExp(/\nRequest tags for\n/)
    );

    expect(firstMatch).not.toBeNull();

    // Task 2 - Update Description right panel check

    await page.getByTestId('message-container').last().click();

    const lastTaskContent = await page.getByTestId('task-title').innerText();

    const lastMatch = lastTaskContent.match(
      new RegExp(/\nRequest to update description for\n/)
    );

    expect(lastMatch).not.toBeNull();

    await page.getByText('Accept Suggestion').click();

    await expect(page.getByRole('alert').first()).toHaveText(
      /Task resolved successfully/
    );

    await page.getByLabel('close').first().click();

    // Task 1 - Request to update tag to be resolved

    await page.getByText('Accept Suggestion').click();

    await expect(page.getByRole('alert').first()).toHaveText(
      /Task resolved successfully/
    );

    await page.getByLabel('close').first().click();

    const closedTask = await page.getByTestId('closed-task').textContent();

    expect(closedTask).toContain('2 Closed');
  });
});
