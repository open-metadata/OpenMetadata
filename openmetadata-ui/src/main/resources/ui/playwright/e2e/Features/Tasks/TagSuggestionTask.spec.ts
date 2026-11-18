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

  test.beforeAll('Create the table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.create(apiContext);
    await afterAction();
  });

  test.afterAll('Delete the table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('shows the suggested tags as tags and applies them on accept', async ({
    page,
  }) => {
    test.slow();

    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const columnName = table.entityResponseData.columns?.[0]?.name ?? '';
    const tableFqn = table.entityResponseData.fullyQualifiedName ?? '';

    try {
      const createResponse = await apiContext.post('/api/v1/tasks', {
        data: {
          about: `<#E::table::${tableFqn}>`,
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
      const task = await createResponse.json();

      await test.step('The task card shows the tag, not raw JSON', async () => {
        const schemaResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response
              .url()
              .includes('/api/v1/taskFormSchemas/name/TagSuggestion'),
          200
        );
        await page.goto(
          `/table/${encodeURIComponent(tableFqn)}/activity_feed/tasks`
        );
        await waitForAllLoadersToDisappear(page);

        const taskCard = getTaskCard(page, task.taskId);
        await expect(taskCard).toBeVisible();
        await taskCard.click();
        await schemaResponse;

        await expect(taskCard.getByTestId('diff-added')).toContainText(
          'Sensitive'
        );
        await expect(taskCard).not.toContainText('"tagFQN"');
      });

      await test.step('The task panel shows tags, not a description', async () => {
        const taskPanel = page.getByTestId('task-tab');

        await expect(
          taskPanel.getByTestId('task-payload-details')
        ).toContainText('Sensitive');
        await expect(taskPanel).not.toContainText('Suggested Description');
        await expect(taskPanel).not.toContainText('"tagFQN"');
      });

      await test.step('Accepting applies the tag to the column', async () => {
        const resolveResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes(`/api/v1/tasks/${task.id}/resolve`) &&
            response.request().method() === 'POST',
          200
        );
        await getTaskCard(page, task.taskId)
          .getByTestId('approve-button')
          .click();
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
