/*
 *  Copyright 2025 Collate.
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

import test, { expect, type APIRequestContext } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, toastNotification } from '../../../utils/common';
import {
  performExpandAll,
  selectActiveGlossary,
  verifyTaskCreated,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';
import { waitForTaskResolveResponse } from '../../../utils/task';
import { performUserLogin } from '../../../utils/user';

const reviewerUser = new UserClass();

const waitForTermStatus = async (
  apiContext: APIRequestContext,
  termId: string,
  expectedStatus: string
) => {
  await expect
    .poll(
      async () => {
        const res = await apiContext
          .get(`/api/v1/glossaryTerms/${termId}?fields=entityStatus`)
          .then((r) => r.json());

        return res?.entityStatus;
      },
      {
        message: `term ${termId} to reach ${expectedStatus}`,
        timeout: 120_000,
        intervals: [3_000, 5_000, 10_000],
      }
    )
    .toBe(expectedStatus);
};

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await reviewerUser.create(apiContext);
  await reviewerUser.setDataStewardRole(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await reviewerUser.delete(apiContext);
  await afterAction();
});

test.describe(
  'Glossary - Approval After Move',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('approving an open task succeeds after the parent term is moved under a sibling', async ({
      browser,
    }) => {
      test.slow(true);

      const { apiContext: adminApiContext, afterAction: adminAfterAction } =
        await performAdminLogin(browser);
      const { page: reviewerPage, afterAction: reviewerAfterAction } =
        await performUserLogin(browser, reviewerUser);

      const glossary = new Glossary();
      const securitiesLending = new GlossaryTerm(glossary);
      const eligibleSecurities = new GlossaryTerm(glossary);
      const productAndService = new GlossaryTerm(glossary);

      try {
        await test.step('Setup: glossary with reviewer', async () => {
          await glossary.create(adminApiContext);
          await glossary.patch(adminApiContext, [
            {
              op: 'add',
              path: '/reviewers/0',
              value: {
                id: reviewerUser.responseData.id,
                type: 'user',
                displayName: reviewerUser.responseData.displayName,
                fullyQualifiedName:
                  reviewerUser.responseData.fullyQualifiedName,
                name: reviewerUser.responseData.name,
              },
            },
          ]);
        });

        await test.step('Setup: Securities Lending → Eligible Securities', async () => {
          await securitiesLending.create(adminApiContext);
          eligibleSecurities.data.parent =
            securitiesLending.responseData.fullyQualifiedName;
          await eligibleSecurities.create(adminApiContext);
        });

        await test.step('Verify approval task is open for Eligible Securities', async () => {
          await verifyTaskCreated(
            reviewerPage,
            eligibleSecurities.responseData.fullyQualifiedName,
            eligibleSecurities.data.name
          );
        });

        await test.step('Setup: create Product and Service (new container)', async () => {
          await productAndService.create(adminApiContext);
        });

        await test.step('Move Securities Lending under Product and Service', async () => {
          const res = await adminApiContext.put(
            `/api/v1/glossaryTerms/${securitiesLending.responseData.id}/moveAsync`,
            {
              data: {
                parent: {
                  id: productAndService.responseData.id,
                  type: 'glossaryTerm',
                  name: productAndService.responseData.name,
                  fullyQualifiedName:
                    productAndService.responseData.fullyQualifiedName,
                },
              },
            }
          );
          expect(res.ok()).toBeTruthy();
        });

        // GlossaryTermTab keys termTaskThreads by task.about.fullyQualifiedName.
        // The approve button only renders once the task FQN cascade has updated
        // the task to the new child FQN — verifyTaskCreated(newFqn) confirms this.
        await test.step('Wait for approval task to be repointed to the new child FQN', async () => {
          const childAfterMove = await adminApiContext
            .get(
              `/api/v1/glossaryTerms/${eligibleSecurities.responseData.id}?fields=fullyQualifiedName`
            )
            .then((r) => r.json());

          await verifyTaskCreated(
            reviewerPage,
            childAfterMove.fullyQualifiedName,
            eligibleSecurities.data.name
          );
        });

        await test.step('Reviewer: expand tree and approve Eligible Securities', async () => {
          await redirectToHomePage(reviewerPage);
          await sidebarClick(reviewerPage, SidebarItem.GLOSSARY);
          await selectActiveGlossary(
            reviewerPage,
            glossary.responseData.displayName
          );
          await performExpandAll(reviewerPage);

          const approveButton = reviewerPage.getByTestId(
            `${eligibleSecurities.data.name}-approve-btn`
          );
          await expect(approveButton).toBeVisible({ timeout: 60_000 });

          const taskResolve = waitForTaskResolveResponse(reviewerPage);
          await approveButton.click();
          await taskResolve;

          await toastNotification(
            reviewerPage,
            /Task resolved successfully|Vote recorded/
          );
        });

        await test.step('Verify Eligible Securities reaches Approved status', async () => {
          await waitForTermStatus(
            adminApiContext,
            eligibleSecurities.responseData.id,
            'Approved'
          );
        });
      } finally {
        await glossary.delete(adminApiContext);
        await adminAfterAction();
        await reviewerAfterAction();
      }
    });
  }
);
