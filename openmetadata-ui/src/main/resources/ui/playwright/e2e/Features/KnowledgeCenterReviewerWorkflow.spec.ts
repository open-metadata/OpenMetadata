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

import { expect } from '@playwright/test';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  checkNotificationAndApproveTask,
  createUserApprovalWorkflowWithOwners,
  verifyTaskStatus,
} from '../../utils/userWorkflowUtils';
import { test } from '../fixtures/pages';

let knowledgePage: { fullyQualifiedName: string; id: string };

test.beforeAll('Setup workflow and knowledge page', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await createUserApprovalWorkflowWithOwners(apiContext, 'page');

  const createResponse = await apiContext.post('/api/v1/knowledgeCenter', {
    data: {
      name: `pw-article-${uuid()}`,
      displayName: `PW Article ${uuid()}`,
      pageType: 'Article',
      page: {
        publicationDate: new Date().toISOString(),
        relatedArticles: [],
      },
      description: 'This is a test description for the knowledge page',
    },
  });
  expect(createResponse.status()).toBe(201);
  knowledgePage = await createResponse.json();

  await afterAction();
});

test.describe(
  'User Approval Workflow - Knowledge Page',
  { tag: ['@Governance'] },
  () => {
    test('Knowledge Page reviewer approval flow', async ({
      page,
      dataConsumerPage,
    }) => {
      test.setTimeout(300_000);

      await redirectToHomePage(page);
      await redirectToHomePage(dataConsumerPage);

      const { apiContext, afterAction } = await getApiContext(page);
      const { apiContext: dcApiContext, afterAction: dcAfterAction } =
        await getApiContext(dataConsumerPage);

      const dcUserResponse = await dcApiContext.get(
        '/api/v1/users/loggedInUser'
      );
      expect(dcUserResponse.status()).toBe(200);
      const dataConsumerUser = await dcUserResponse.json();
      await dcAfterAction();

      const patchResponse = await apiContext.patch(
        `/api/v1/knowledgeCenter/${knowledgePage.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/reviewers/0',
              value: {
                id: dataConsumerUser.id,
                type: 'user',
                displayName: dataConsumerUser.displayName,
                fullyQualifiedName: dataConsumerUser.fullyQualifiedName,
                name: dataConsumerUser.name,
              },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
      expect(patchResponse.status()).toBe(200);
      knowledgePage = await patchResponse.json();

      const encodedFqn = encodeURIComponent(knowledgePage.fullyQualifiedName);

      await test.step('Navigate to Context Center Page', async () => {
        await page.goto(`/context-center/articles/${encodedFqn}`);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Verify In Review status', async () => {
        await verifyTaskStatus(
          page,
          'inReview',
          knowledgePage,
          'In Review',
          apiContext,
          'knowledgeCenter'
        );
      });

      await test.step('Reviewer - Check notification and approve task', async () => {
        await checkNotificationAndApproveTask(dataConsumerPage, async () => {
          await dataConsumerPage.goto(
            `/context-center/articles/${encodedFqn}`
          );
        });
      });

      await test.step('Verify Approved status', async () => {
        await verifyTaskStatus(
          page,
          'success',
          knowledgePage,
          'Approved',
          apiContext,
          'knowledgeCenter'
        );
      });

      await afterAction();
    });
  }
);
