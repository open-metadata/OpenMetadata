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
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { getTaskCard } from '../../../utils/task';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { expect, test } from '../../fixtures/pages';

// An agent proposes tags as a Suggestion task whose suggestedValue is the
// tag labels as a JSON string; the reviewer must see tags, not that JSON.
test.describe('Tag suggestion task', () => {
  const table = new TableClass();
  const suggestedTag = {
    tagFQN: 'PII.Sensitive',
    source: 'Classification',
    labelType: 'Generated',
    state: 'Suggested',
  };
  let task: { id: string; taskId: string } | undefined;
  let columnName: string;

  test.beforeAll(
    'Create the table and its tag suggestion',
    async ({ browser }) => {
      // beforeAll can run more than once per worker; start from a clean slate.
      task = undefined;
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await table.create(apiContext);
        columnName = table.entityResponseData.columns?.[0]?.name ?? '';

        const createResponse = await apiContext.post('/api/v1/tasks', {
          data: {
            about: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
            type: 'Suggestion',
            category: 'MetadataUpdate',
            assignees: ['admin'],
            payload: {
              source: 'Agent',
              suggestionType: 'Tag',
              fieldPath: `columns.${columnName}.tags`,
              suggestedValue: JSON.stringify([suggestedTag]),
            },
          },
        });
        expect(createResponse.ok()).toBe(true);
        task = await createResponse.json();
      } finally {
        await afterAction();
      }
    }
  );

  test.afterAll('Delete the task and the table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Skip when beforeAll failed before creating it, so the table is still deleted.
      if (task) {
        await apiContext.delete(`/api/v1/tasks/${task.id}?hardDelete=true`);
      }
      await table.delete(apiContext);
    } finally {
      await afterAction();
    }
  });

  test('shows the suggested tags as tags and applies them on accept', async ({
    page,
  }) => {
    test.slow();

    if (!task) {
      throw new Error('beforeAll did not create the tag suggestion task');
    }
    const { id: taskEntityId, taskId } = task;

    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const tableFqn = table.entityResponseData.fullyQualifiedName ?? '';

    try {
      await test.step('The task card shows the tag, not raw JSON', async () => {
        await page.goto(
          `/table/${encodeURIComponent(tableFqn)}/activity_feed/tasks`
        );
        await waitForAllLoadersToDisappear(page);

        const taskCard = getTaskCard(page, taskId);
        await expect(taskCard).toBeVisible();
        await taskCard.click();

        // Exact text: "PII.Sensitive" is also a substring of the raw JSON.
        await expect(
          taskCard
            .getByTestId('diff-added')
            .getByText(suggestedTag.tagFQN, { exact: true })
        ).toBeVisible();
        await expect(taskCard).not.toContainText('"tagFQN"');
      });

      await test.step('The task panel shows tags, not a description', async () => {
        const taskPanel = page.getByTestId('task-tab');

        await expect(
          taskPanel
            .getByTestId('task-payload-details')
            .getByText(suggestedTag.tagFQN, { exact: true })
        ).toBeVisible();
        await expect(taskPanel).not.toContainText('Suggested Description');
        await expect(taskPanel).not.toContainText('"tagFQN"');
      });

      await test.step('Accepting applies the tag to the column', async () => {
        const resolveResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes(`/api/v1/tasks/${taskEntityId}/resolve`) &&
            response.request().method() === 'POST',
          200
        );
        await getTaskCard(page, taskId).getByTestId('approve-button').click();
        await resolveResponse;

        await expect
          .poll(async () => {
            const tableResponse = await apiContext.get(
              `/api/v1/tables/${table.entityResponseData.id}?fields=columns,tags`
            );
            const { columns } = await tableResponse.json();

            return columns
              .find((column: { name: string }) => column.name === columnName)
              ?.tags?.map((tag: { tagFQN: string }) => tag.tagFQN);
          })
          .toContain(suggestedTag.tagFQN);
      });
    } finally {
      await afterAction();
    }
  });
});
