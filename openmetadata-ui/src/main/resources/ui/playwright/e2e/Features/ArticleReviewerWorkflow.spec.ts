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
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { createArticleViaApi } from '../../utils/ContextCenterUtil';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  addReviewerToEntity,
  checkNotificationAndApproveTask,
  createUserApprovalWorkflow,
  verifyTaskStatus,
} from '../../utils/reviewerWorkflow.utils';
import { test } from '../fixtures/pages';

let article: { fullyQualifiedName: string; id: string };

test.beforeAll('Setup workflow and article', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await createUserApprovalWorkflow(apiContext, 'page');
  article = await createArticleViaApi(apiContext, {
    description: 'This is a test description for the article',
  });

  await afterAction();
});

test.describe(
  'User Approval Workflow - Context Center Article',
  { tag: ['@Governance'] },
  () => {
    test('Context Center article reviewer approval flow', async ({
      page,
      dataConsumerPage,
    }) => {
      test.setTimeout(300_000);

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

      const encodedFqn = encodeURIComponent(article.fullyQualifiedName);

      await test.step('Navigate to Context Center Article', async () => {
        await page.goto(`/context-center/articles/${encodedFqn}`);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Add reviewer to Article', async () => {
        await addReviewerToEntity(
          page,
          dataConsumerUser.name,
          dataConsumerUser.displayName,
          'contextCenter'
        );
      });

      await test.step('Verify In Review status', async () => {
        await verifyTaskStatus(
          page,
          'inReview',
          article,
          'In Review',
          apiContext,
          'contextCenter'
        );
      });

      await test.step('Reviewer - Check notification and approve task', async () => {
        await checkNotificationAndApproveTask(dataConsumerPage, async () => {
          await dataConsumerPage.goto(`/context-center/articles/${encodedFqn}`);
        });
      });

      await test.step('Verify Approved status', async () => {
        await verifyTaskStatus(
          page,
          'success',
          article,
          'Approved',
          apiContext,
          'contextCenter'
        );
      });

      await afterAction();
    });
  }
);
