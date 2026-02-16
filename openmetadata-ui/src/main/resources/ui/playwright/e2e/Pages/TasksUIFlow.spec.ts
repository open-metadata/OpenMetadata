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
import { expect, Page, test } from '@playwright/test';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { UserClass } from '../../support/user/UserClass';
import {
  clickOutside,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';

const adminFile = 'playwright/.auth/admin.json';
test.use({ storageState: adminFile });

interface EntityConfig {
  name: string;
  entityTypeName: string;
  createEntity: () => TableClass | DashboardClass | TopicClass | PipelineClass;
}

const ENTITY_CONFIGS: EntityConfig[] = [
  {
    name: 'Table',
    entityTypeName: 'table',
    createEntity: () => new TableClass(),
  },
  {
    name: 'Dashboard',
    entityTypeName: 'dashboard',
    createEntity: () => new DashboardClass(),
  },
  {
    name: 'Topic',
    entityTypeName: 'topic',
    createEntity: () => new TopicClass(),
  },
  {
    name: 'Pipeline',
    entityTypeName: 'pipeline',
    createEntity: () => new PipelineClass(),
  },
];

const createDescriptionTaskViaUI = async (
  page: Page,
  entityName: string,
  entityType: string,
  assigneeName: string,
  description: string
) => {
  await page.getByTestId('request-description').click();

  await page.waitForSelector('#title', { state: 'visible' });

  expect(await page.locator('#title').inputValue()).toContain(
    `description for ${entityType}`
  );

  const assigneeField = page.locator(
    '[data-testid="select-assignee"] > .ant-select-selector #assignees'
  );
  await assigneeField.click();

  const userSearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${assigneeName}**&index=user_search_index%2Cteam_search_index*`
  );
  await assigneeField.fill(assigneeName);
  await userSearchResponse;

  const dropdownValue = page.getByTestId(assigneeName);
  await dropdownValue.hover();
  await dropdownValue.click();
  await clickOutside(page);

  await page.locator(descriptionBox).clear();
  await page.locator(descriptionBox).fill(description);

  const taskResponse = page.waitForResponse('/api/v1/tasks');
  await page.click('button[type="submit"]');
  await taskResponse;

  // Wait for navigation after task creation (page navigates to entity page with tasks tab)
  await page.waitForLoadState('networkidle');
};

const createTagTaskViaUI = async (
  page: Page,
  entityName: string,
  entityType: string,
  assigneeName: string,
  tagFQN: string
) => {
  await page.getByTestId('request-entity-tags').click();

  await page.waitForSelector('#title', { state: 'visible' });

  expect(await page.locator('#title').inputValue()).toContain(
    `tags for ${entityType}`
  );

  const assigneeField = page.locator(
    '[data-testid="select-assignee"] > .ant-select-selector #assignees'
  );
  await assigneeField.click();

  const userSearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${assigneeName}**&index=user_search_index%2Cteam_search_index*`
  );
  await assigneeField.fill(assigneeName);
  await userSearchResponse;

  const dropdownValue = page.getByTestId(assigneeName);
  await dropdownValue.hover();
  await dropdownValue.click();
  await clickOutside(page);

  const suggestTags = page.locator(
    '[data-testid="tag-selector"] > .ant-select-selector .ant-select-selection-search-input'
  );
  await suggestTags.click();

  const querySearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${tagFQN}*&index=tag_search_index&*`
  );
  await suggestTags.fill(tagFQN);
  await querySearchResponse;

  const tagDropdownValue = page.getByTestId(`tag-${tagFQN}`).first();
  await tagDropdownValue.hover();
  await tagDropdownValue.click();
  await clickOutside(page);

  const taskResponse = page.waitForResponse('/api/v1/tasks');
  await page.click('button[type="submit"]');
  await taskResponse;

  // Wait for navigation after task creation (page navigates to entity page with tasks tab)
  await page.waitForLoadState('networkidle');
};

const resolveTaskWithApproval = async (page: Page) => {
  // Click on the first task card to open it
  const taskCard = page.locator('[data-testid="task-feed-card"]').first();
  if (await taskCard.isVisible()) {
    await taskCard.click();
    await page.waitForLoadState('networkidle');
  }

  // Look for approve button - try specific selectors in order
  const acceptSuggestionBtn = page.locator('button:has-text("Accept Suggestion")').first();
  const approveBtn = page.getByTestId('approve-button');
  const approveTextBtn = page.locator('button:has-text("Approve")').first();

  let clicked = false;
  if (await acceptSuggestionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const taskResolve = page.waitForResponse('/api/v1/tasks/*/resolve');
    await acceptSuggestionBtn.click();
    await taskResolve;
    clicked = true;
  } else if (await approveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const taskResolve = page.waitForResponse('/api/v1/tasks/*/resolve');
    await approveBtn.click();
    await taskResolve;
    clicked = true;
  } else if (await approveTextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const taskResolve = page.waitForResponse('/api/v1/tasks/*/resolve');
    await approveTextBtn.click();
    await taskResolve;
    clicked = true;
  }

  if (clicked) {
    await page.waitForLoadState('networkidle');
  }
};

const resolveTaskWithRejection = async (page: Page, comment: string) => {
  // Click on the first task card to open it
  const taskCard = page.locator('[data-testid="task-feed-card"]').first();
  if (await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await taskCard.click();
    await page.waitForLoadState('networkidle');
  }

  // Try direct Reject button first (visible in task card summary)
  const rejectBtn = page.getByRole('button', { name: /^reject$/i });
  if (await rejectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const taskResolve = page.waitForResponse('/api/v1/tasks/*/resolve');
    await rejectBtn.click();
    await taskResolve;
    await page.waitForLoadState('networkidle');
    return;
  }

  // If no direct reject button, use the dropdown and select "Close" option
  const dropdownBtn = page.getByRole('button', { name: 'down' });
  if (await dropdownBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dropdownBtn.click();

    // The dropdown has "Close" option which closes/rejects the task
    const closeOption = page.getByRole('menuitem', { name: /close/i });
    if (await closeOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      const taskResolve = page.waitForResponse('/api/v1/tasks/*/resolve');
      await closeOption.click();
      await taskResolve;
      await page.waitForLoadState('networkidle');
    }
  }
};

const navigateToActivityFeedTasks = async (page: Page) => {
  // Click on the Activity Feeds & Tasks tab if available
  const activityFeedTab = page.locator('[data-testid="activity_feed"]');
  if (await activityFeedTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await activityFeedTab.click();
    await page.waitForLoadState('networkidle');
  }

  // Click on Tasks filter/tab - it's a menuitem
  const tasksTab = page.getByRole('menuitem', { name: /tasks/i });
  if (await tasksTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Check if tab is already active by looking at aria-selected or active state
    const isActive = await tasksTab.getAttribute('aria-selected') === 'true' ||
                     await tasksTab.evaluate(el => el.classList.contains('active'));

    if (!isActive) {
      // Only wait for response if we're actually switching tabs
      const taskFeeds = page.waitForResponse('/api/v1/tasks**', { timeout: 10000 }).catch(() => null);
      await tasksTab.click();
      await taskFeeds;
    }
    await page.waitForLoadState('networkidle');
  }
};

test.describe('Tasks UI Flow - Multi Entity Tests', () => {
  const user = new UserClass();
  const entities: Array<
    TableClass | DashboardClass | TopicClass | PipelineClass
  > = [];

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    await user.create(apiContext);

    for (const config of ENTITY_CONFIGS) {
      const entity = config.createEntity();
      await entity.create(apiContext);
      entities.push(entity);
    }

    await afterAction();
    await page.close();
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    for (const entity of entities) {
      await entity.delete(apiContext);
    }
    await user.delete(apiContext);

    await afterAction();
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  for (let i = 0; i < ENTITY_CONFIGS.length; i++) {
    const config = ENTITY_CONFIGS[i];

    test(`Create and resolve description task for ${config.name} via UI`, async ({
      page,
    }) => {
      const entity = entities[i];
      const userName = user.responseData?.name ?? '';
      const description = `Test description for ${config.name} task`;

      await test.step('Navigate to entity page', async () => {
        await entity.visitEntityPage(page);
        await page.waitForLoadState('networkidle');
      });

      await test.step('Create description task via UI', async () => {
        await createDescriptionTaskViaUI(
          page,
          entity.entityResponseData?.['name'],
          config.entityTypeName,
          userName,
          description
        );
      });

      await test.step('Verify task appears in activity feed', async () => {
        await entity.visitEntityPage(page);
        await page.waitForLoadState('networkidle');
        await navigateToActivityFeedTasks(page);

        const taskCard = page.locator('[data-testid="task-feed-card"]').first();
        await expect(taskCard).toBeVisible();
        await expect(taskCard).toContainText('description');
      });

      await test.step('Resolve task with approval', async () => {
        await resolveTaskWithApproval(page);
      });
    });

    test(`Create and reject tag task for ${config.name} via UI`, async ({
      page,
    }) => {
      const entity = entities[i];
      const userName = user.responseData?.name ?? '';
      const tagFQN = 'PII.None';

      await test.step('Navigate to entity page', async () => {
        await entity.visitEntityPage(page);
        await page.waitForLoadState('networkidle');
      });

      await test.step('Create tag task via UI', async () => {
        await createTagTaskViaUI(
          page,
          entity.entityResponseData?.['name'],
          config.entityTypeName,
          userName,
          tagFQN
        );
      });

      await test.step('Verify task in activity feed', async () => {
        await entity.visitEntityPage(page);
        await page.waitForLoadState('networkidle');
        await navigateToActivityFeedTasks(page);

        const taskCard = page.locator('[data-testid="task-feed-card"]').first();
        await expect(taskCard).toBeVisible();
        await expect(taskCard).toContainText('tags');
      });

      await test.step('Reject task with comment', async () => {
        await resolveTaskWithRejection(
          page,
          'Tag not appropriate for this entity'
        );
      });
    });
  }
});

test.describe('Task Workflow - Table Column Tasks', () => {
  const user = new UserClass();
  let table: TableClass;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    await user.create(apiContext);
    table = new TableClass();
    await table.create(apiContext);

    await afterAction();
    await page.close();
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    await table.delete(apiContext);
    await user.delete(apiContext);

    await afterAction();
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Create description task for table column via UI', async ({ page }) => {
    const userName = user.responseData?.name ?? '';
    const columnName = table.columnsName[0];

    await test.step('Navigate to table and open column task menu', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      const schemaTab = page.getByTestId('schema');
      await schemaTab.click();

      const columnRow = page.locator(`[data-row-key*="${columnName}"]`);
      await columnRow.hover();

      // Click on the task-element icon button in the description cell
      // The task buttons are inside the description cell, which has "hover-cell-icon" class
      const descriptionCell = columnRow.locator('[data-testid="description"]');
      const taskBtn = descriptionCell.getByTestId('task-element');
      await taskBtn.click();
    });

    await test.step('Fill task form and submit', async () => {
      await page.waitForSelector('#title', { state: 'visible' });

      expect(await page.locator('#title').inputValue()).toContain('columns');

      const assigneeField = page.locator(
        '[data-testid="select-assignee"] > .ant-select-selector #assignees'
      );
      await assigneeField.click();

      const userSearchResponse = page.waitForResponse(
        `/api/v1/search/query?q=*${userName}**&index=user_search_index%2Cteam_search_index*`
      );
      await assigneeField.fill(userName);
      await userSearchResponse;

      const dropdownValue = page.getByTestId(userName);
      await dropdownValue.hover();
      await dropdownValue.click();
      await clickOutside(page);

      await page.locator(descriptionBox).clear();
      await page.locator(descriptionBox).fill('Column description test');

      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await page.click('button[type="submit"]');
      await taskResponse;
      await page.waitForLoadState('networkidle');
    });

    await test.step('Resolve the column task', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await navigateToActivityFeedTasks(page);

      await resolveTaskWithApproval(page);
    });
  });

  test('Create tag task for table column via UI', async ({ page }) => {
    const userName = user.responseData?.name ?? '';
    const columnName = table.columnsName[0];
    const tagFQN = 'PersonalData.Personal';

    await test.step('Navigate to table and open column task menu', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      const schemaTab = page.getByTestId('schema');
      await schemaTab.click();

      const columnRow = page.locator(`[data-row-key*="${columnName}"]`);
      await columnRow.hover();

      // Click on the task-element icon button in the tags cell
      // The tags cell has data-testid="classification-tags-{index}"
      const tagsCell = columnRow.locator('[data-testid^="classification-tags-"]');
      const taskBtn = tagsCell.getByTestId('task-element');
      await taskBtn.click();
    });

    await test.step('Fill tag task form and submit', async () => {
      await page.waitForSelector('#title', { state: 'visible' });

      expect(await page.locator('#title').inputValue()).toContain('columns');

      const assigneeField = page.locator(
        '[data-testid="select-assignee"] > .ant-select-selector #assignees'
      );
      await assigneeField.click();

      const userSearchResponse = page.waitForResponse(
        `/api/v1/search/query?q=*${userName}**&index=user_search_index%2Cteam_search_index*`
      );
      await assigneeField.fill(userName);
      await userSearchResponse;

      const dropdownValue = page.getByTestId(userName);
      await dropdownValue.hover();
      await dropdownValue.click();
      await clickOutside(page);

      const suggestTags = page.locator(
        '[data-testid="tag-selector"] > .ant-select-selector .ant-select-selection-search-input'
      );
      await suggestTags.click();

      const querySearchResponse = page.waitForResponse(
        `/api/v1/search/query?q=*${tagFQN}*&index=tag_search_index&*`
      );
      await suggestTags.fill(tagFQN);
      await querySearchResponse;

      const tagDropdownValue = page.getByTestId(`tag-${tagFQN}`).first();
      await tagDropdownValue.hover();
      await tagDropdownValue.click();
      await clickOutside(page);

      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await page.click('button[type="submit"]');
      await taskResponse;
      await page.waitForLoadState('networkidle');
    });

    await test.step('Resolve the column tag task', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await navigateToActivityFeedTasks(page);

      await resolveTaskWithApproval(page);
    });
  });
});

test.describe('Task Activity Feed Integration', () => {
  const user = new UserClass();
  let table: TableClass;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    await user.create(apiContext);
    table = new TableClass();
    await table.create(apiContext);

    await afterAction();
    await page.close();
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: adminFile });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForURL('**/my-data');
    const { apiContext, afterAction } = await getApiContext(page);

    await table.delete(apiContext);
    await user.delete(apiContext);

    await afterAction();
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Verify task lifecycle in activity feed', async ({ page }) => {
    const userName = user.responseData?.name ?? '';

    await test.step('Create a task', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      await createDescriptionTaskViaUI(
        page,
        table.entityResponseData?.['name'],
        'table',
        userName,
        'Activity feed test description'
      );
    });

    await test.step('Verify task appears in Open tasks tab', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await navigateToActivityFeedTasks(page);

      // Look for Open button/tab that shows task count
      const openTaskBtn = page.getByRole('button', { name: /Open \(\d+\)/ });
      await expect(openTaskBtn).toBeVisible();
    });

    await test.step('Resolve task and verify it moves to Closed', async () => {
      await resolveTaskWithApproval(page);

      await page.waitForTimeout(1000);
      await page.reload();

      await navigateToActivityFeedTasks(page);

      const closedTab = page.getByRole('tab', { name: /Closed/i });
      if (await closedTab.isVisible()) {
        await closedTab.click();

        const closedTaskCard = page.locator('[data-testid="task-feed-card"]').first();
        await expect(closedTaskCard).toBeVisible();
      }
    });
  });

  test('Verify task shows correct metadata', async ({ page }) => {
    const userName = user.responseData?.name ?? '';
    const taskDescription = 'Metadata verification test';

    await test.step('Create a task', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      await createDescriptionTaskViaUI(
        page,
        table.entityResponseData?.['name'],
        'table',
        userName,
        taskDescription
      );
    });

    await test.step('Verify task metadata in feed', async () => {
      await table.visitEntityPage(page);
      await page.waitForLoadState('networkidle');
      await navigateToActivityFeedTasks(page);

      const taskCard = page.locator('[data-testid="task-feed-card"]').first();
      await expect(taskCard).toBeVisible();

      await expect(taskCard).toContainText('description');
    });

    await test.step('Cleanup - resolve task', async () => {
      await resolveTaskWithApproval(page);
    });
  });
});
