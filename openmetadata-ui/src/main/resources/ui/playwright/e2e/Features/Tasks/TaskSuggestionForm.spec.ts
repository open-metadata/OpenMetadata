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
import { APIRequestContext } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { okJson } from '../../../utils/apiResponse';
import { uuid } from '../../../utils/common';
import {
  CreatedTask,
  openEntityTasksTab,
  openTaskDetails,
} from '../../../utils/taskWorkflow';
import { expect, test } from '../../fixtures/pages';

const SUGGESTED_TAG_FQN = 'PII.Sensitive';

const createSuggestionTask = async (
  apiContext: APIRequestContext,
  table: TableClass,
  payload: Record<string, unknown>
) =>
  okJson<CreatedTask>(
    await apiContext.post('/api/v1/tasks', {
      data: {
        about: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
        type: 'Suggestion',
        category: 'MetadataUpdate',
        assignees: ['admin'],
        payload: { source: 'Agent', ...payload },
      },
    }),
    'create suggestion task'
  );

test.describe('Suggestion task form', { tag: [DOMAIN_TAGS.GOVERNANCE] }, () => {
  const tagTable = new TableClass();
  const descriptionTable = new TableClass();
  const suggestedDescription = `pw suggested description ${uuid()}`;
  const createdTasks: CreatedTask[] = [];
  let tagTask: CreatedTask;
  let descriptionTask: CreatedTask;

  test.beforeAll('Create tables and suggestion tasks', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await Promise.all([
        tagTable.create(apiContext),
        descriptionTable.create(apiContext),
      ]);
      tagTask = await createSuggestionTask(apiContext, tagTable, {
        suggestionType: 'Tag',
        fieldPath: 'tags',
        suggestedValue: JSON.stringify([
          {
            tagFQN: SUGGESTED_TAG_FQN,
            source: 'Classification',
            labelType: 'Manual',
            state: 'Suggested',
          },
        ]),
      });
      descriptionTask = await createSuggestionTask(
        apiContext,
        descriptionTable,
        {
          suggestionType: 'Description',
          fieldPath: 'description',
          suggestedValue: suggestedDescription,
        }
      );
      createdTasks.push(tagTask, descriptionTask);
    } finally {
      await afterAction();
    }
  });

  test.afterAll('Delete tasks and tables', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await Promise.all(
        createdTasks.map((task) =>
          apiContext.delete(`/api/v1/tasks/${task.id}?hardDelete=true`)
        )
      );
      await Promise.all([
        tagTable.delete(apiContext),
        descriptionTable.delete(apiContext),
      ]);
    } finally {
      await afterAction();
    }
  });

  test('a tag suggestion shows the suggested tags, not a description field', async ({
    page,
  }) => {
    await tagTable.visitEntityPage(page);
    await openEntityTasksTab(page);
    await openTaskDetails(page, tagTask);

    const payloadDetails = page.getByTestId('task-payload-details');

    await expect(
      payloadDetails.getByText(SUGGESTED_TAG_FQN, { exact: true })
    ).toBeVisible();
    await expect(payloadDetails).not.toContainText('Suggested Description');
  });

  test('a description suggestion shows the suggested description', async ({
    page,
  }) => {
    await descriptionTable.visitEntityPage(page);
    await openEntityTasksTab(page);
    await openTaskDetails(page, descriptionTask);

    await expect(page.getByTestId('task-payload-details')).toContainText(
      suggestedDescription
    );
  });
});
