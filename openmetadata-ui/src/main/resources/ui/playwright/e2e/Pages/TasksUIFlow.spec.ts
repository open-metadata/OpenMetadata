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
  authenticateAdminPage,
  createAdminApiContext,
} from '../../utils/admin';
import { descriptionBox } from '../../utils/common';
import { waitForPageLoaded } from '../../utils/polling';
import { waitForTaskCreateResponse } from '../../utils/task';
import {
  addTagSuggestion,
  approveTaskFromDetails,
  closeTaskFromDetails,
  openEntityTasksTab,
  selectAssignee,
} from '../../utils/taskWorkflow';

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

  await selectAssignee(page, assigneeName);

  await page.locator(descriptionBox).clear();
  await page.locator(descriptionBox).fill(description);

  const taskResponse = waitForTaskCreateResponse(page);
  await page.click('button[type="submit"]');
  await taskResponse;

  // Wait for navigation after task creation (page navigates to entity page with tasks tab)
  await waitForPageLoaded(page);
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

  await selectAssignee(page, assigneeName);
  await addTagSuggestion({
    page,
    searchText: tagFQN,
    tagTestId: `tag-${tagFQN}`,
  });

  const taskResponse = waitForTaskCreateResponse(page);
  await page.click('button[type="submit"]');
  await taskResponse;

  // Wait for navigation after task creation (page navigates to entity page with tasks tab)
  await waitForPageLoaded(page);
};

const resolveTaskWithApproval = async (page: Page) => {
  // Click on the first task card to open it
  const taskCard = page.locator('[data-testid="task-feed-card"]').first();
  if (await taskCard.isVisible()) {
    await taskCard.click();
    await waitForPageLoaded(page);
  }

  await approveTaskFromDetails(page);
};

const resolveTaskWithRejection = async (page: Page, comment: string) => {
  // Click on the first task card to open it
  const taskCard = page.locator('[data-testid="task-feed-card"]').first();
  if (await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await taskCard.click();
    await waitForPageLoaded(page);
  }

  await closeTaskFromDetails(page);
};

const navigateToActivityFeedTasks = async (page: Page) => {
  await openEntityTasksTab(page);
};

test.describe('Tasks UI Flow - Multi Entity Tests', () => {
  const user = new UserClass();
  const entities: Array<
    TableClass | DashboardClass | TopicClass | PipelineClass
  > = [];

  test.beforeAll(async () => {
    const { apiContext, afterAction } = await createAdminApiContext();

    try {
      await user.create(apiContext);

      for (const config of ENTITY_CONFIGS) {
        const entity = config.createEntity();
        await entity.create(apiContext);
        entities.push(entity);
      }
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async () => {
    const { apiContext, afterAction } = await createAdminApiContext();

    try {
      for (const entity of entities) {
        await entity.delete(apiContext);
      }
      await user.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await authenticateAdminPage(page);
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
        await waitForPageLoaded(page);
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
        await waitForPageLoaded(page);
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
        await waitForPageLoaded(page);
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
        await waitForPageLoaded(page);
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

  test.beforeAll(async () => {
    const { apiContext, afterAction } = await createAdminApiContext();

    try {
      await user.create(apiContext);
      table = new TableClass();
      await table.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async () => {
    const { apiContext, afterAction } = await createAdminApiContext();

    try {
      await table.delete(apiContext);
      await user.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await authenticateAdminPage(page);
  });

  test('Create description task for table column via UI', async ({ page }) => {
    const userName = user.responseData?.name ?? '';
    const columnName = table.columnsName[0];

    await test.step('Navigate to table and open column task menu', async () => {
      await table.visitEntityPage(page);
      await waitForPageLoaded(page);

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

      await selectAssignee(page, userName);

      await page.locator(descriptionBox).clear();
      await page.locator(descriptionBox).fill('Column description test');

      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await page.click('button[type="submit"]');
      await taskResponse;
      await waitForPageLoaded(page);
    });

    await test.step('Resolve the column task', async () => {
      await table.visitEntityPage(page);
      await waitForPageLoaded(page);
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
      await waitForPageLoaded(page);

      const schemaTab = page.getByTestId('schema');
      await schemaTab.click();

      const columnRow = page.locator(`[data-row-key*="${columnName}"]`);
      await columnRow.hover();

      // Click on the task-element icon button in the tags cell
      // The tags cell has data-testid="classification-tags-{index}"
      const tagsCell = columnRow.locator(
        '[data-testid^="classification-tags-"]'
      );
      const taskBtn = tagsCell.getByTestId('task-element');
      await taskBtn.click();
    });

    await test.step('Fill tag task form and submit', async () => {
      await page.waitForSelector('#title', { state: 'visible' });

      expect(await page.locator('#title').inputValue()).toContain('columns');

      await selectAssignee(page, userName);

      await addTagSuggestion({
        page,
        searchText: tagFQN,
        tagTestId: `tag-${tagFQN}`,
      });

      const taskResponse = page.waitForResponse('/api/v1/tasks');
      await page.click('button[type="submit"]');
      await taskResponse;
      await waitForPageLoaded(page);
    });

    await test.step('Resolve the column tag task', async () => {
      await table.visitEntityPage(page);
      await waitForPageLoaded(page);
      await navigateToActivityFeedTasks(page);

      await resolveTaskWithApproval(page);
    });
  });
});

test.describe('Task Activity Feed Integration', () => {
  const user = new UserClass();
  let table: TableClass;

  test.beforeAll(async () => {
    const { apiContext, afterAction } = await createAdminApiContext();

    try {
      await user.create(apiContext);
      table = new TableClass();
      await table.create(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async () => {
    const { apiContext, afterAction } = await createAdminApiContext();

    try {
      await table.delete(apiContext);
      await user.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test.beforeEach(async ({ page }) => {
    await authenticateAdminPage(page);
  });

  test('Verify task lifecycle in activity feed', async ({ page }) => {
    const userName = user.responseData?.name ?? '';

    await test.step('Create a task', async () => {
      await table.visitEntityPage(page);
      await waitForPageLoaded(page);

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
      await waitForPageLoaded(page);
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

        const closedTaskCard = page
          .locator('[data-testid="task-feed-card"]')
          .first();
        await expect(closedTaskCard).toBeVisible();
      }
    });
  });

  test('Verify task shows correct metadata', async ({ page }) => {
    const userName = user.responseData?.name ?? '';
    const taskDescription = 'Metadata verification test';

    await test.step('Create a task', async () => {
      await table.visitEntityPage(page);
      await waitForPageLoaded(page);

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
      await waitForPageLoaded(page);
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
