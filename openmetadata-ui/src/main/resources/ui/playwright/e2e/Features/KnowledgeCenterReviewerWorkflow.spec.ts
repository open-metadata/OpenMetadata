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
import { test } from '../fixtures/pages';
import {
  addReviewerToEntity,
  checkNotificationAndApproveTask,
  createUserApprovalWorkflow,
  verifyTaskStatus,
} from '../Utils/UserApprovalWorkfow.utils';

let knowledgePage: { fullyQualifiedName: string; id: string };

test.beforeAll('Setup workflow and knowledge page', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await createUserApprovalWorkflow(apiContext, 'page');
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
      test.slow();

      // Both pages must be at home before reading IndexedDB tokens.
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

      const encodedFqn = encodeURIComponent(knowledgePage.fullyQualifiedName);

      await test.step('Navigate to Knowledge Page', async () => {
        await page.goto(`/knowledge-center/${encodedFqn}`);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Add reviewer to Knowledge Page', async () => {
        await addReviewerToEntity(
          page,
          dataConsumerUser.name,
          dataConsumerUser.displayName,
          'knowledgeCenter'
        );
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
          await dataConsumerPage.goto(`/knowledge-center/${encodedFqn}`);
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
