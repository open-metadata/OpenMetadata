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
import { APIRequestContext, Page, Response } from '@playwright/test';
import { Glossary } from '../../../support/glossary/Glossary';
import { okJson } from '../../../utils/apiResponse';
import {
  getApiContext,
  redirectToHomePage,
  resolveDescriptionBox,
  uuid,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { expect, test } from '../../fixtures/pages';

/**
 * The held-change review lifecycle on a glossary that an Enforce-mode workflow gates: a requester's
 * description edit is held as a change request while the glossary keeps its published description,
 * and a reviewer's decision in the pending changes dialog publishes or drops it. Each glossary has
 * its own workflow, filtered to that glossary alone, so no other spec's edits are held.
 */

type UserRef = {
  id: string;
  name: string;
  fullyQualifiedName: string;
  type: 'user';
};

type GatedGlossary = { glossary: Glossary; workflowId: string };

const PUBLISHED = 'Published description of the gated glossary';

const isDescriptionPatch = (glossary: Glossary) => (response: Response) =>
  response.request().method() === 'PATCH' &&
  response.url().includes(`/api/v1/glossaries/${glossary.responseData.id}`);

const isResolve = (response: Response) =>
  /\/api\/v1\/tasks\/[^/]+\/resolve/.test(response.url()) &&
  response.request().method() === 'POST';

const isWithdraw = (response: Response) =>
  /\/api\/v1\/changeRequests\/[^/]+\/withdraw/.test(response.url()) &&
  response.request().method() === 'POST';

// A role page carries its token once the app has loaded.
const loggedInUser = async (page: Page): Promise<UserRef> => {
  await redirectToHomePage(page);
  const { apiContext, afterAction } = await getApiContext(page);
  const user = await okJson<{
    id: string;
    name: string;
    fullyQualifiedName: string;
  }>(await apiContext.get('/api/v1/users/loggedInUser'), 'loggedInUser');
  await afterAction();

  return {
    id: user.id,
    name: user.name,
    fullyQualifiedName: user.fullyQualifiedName,
    type: 'user',
  };
};

// Approve publishes the held edit and reject drops it, inside the approval step.
const createEnforceWorkflow = async (
  apiContext: APIRequestContext,
  glossaryFqn: string,
  assignees: Record<string, unknown>
) => {
  const workflow = await okJson<{ id: string }>(
    await apiContext.post('/api/v1/governance/workflowDefinitions', {
      data: {
        name: `PwChangeRequestReview${uuid()}`,
        displayName: 'Playwright change request review',
        description: 'Holds description edits on one glossary for review.',
        config: { storeStageStatus: true },
        trigger: {
          type: 'eventBasedEntity',
          config: {
            approvalMode: 'Enforce',
            entityTypes: ['glossary'],
            events: ['Updated'],
            include: ['description'],
            exclude: [],
            filter: {
              glossary: JSON.stringify({
                '!=': [{ var: 'fullyQualifiedName' }, glossaryFqn],
              }),
            },
          },
          output: ['relatedEntity', 'updatedBy'],
        },
        nodes: [
          { type: 'startEvent', subType: 'startEvent', name: 'Start' },
          {
            type: 'userTask',
            subType: 'userApprovalTask',
            name: 'Approve',
            config: {
              assignees,
              approvalThreshold: 1,
              rejectionThreshold: 1,
              stageId: 'review',
              stageDisplayName: 'Review',
              taskStatus: 'Open',
              transitionMetadata: [
                {
                  id: 'approve',
                  label: 'Approve',
                  targetStageId: 'approved',
                  targetTaskStatus: 'Approved',
                  resolutionType: 'Approved',
                  formRef: 'approve',
                  requiresComment: false,
                },
                {
                  id: 'reject',
                  label: 'Reject',
                  targetStageId: 'rejected',
                  targetTaskStatus: 'Rejected',
                  resolutionType: 'Rejected',
                  formRef: 'reject',
                  requiresComment: false,
                },
              ],
            },
            inputNamespaceMap: { relatedEntity: 'global' },
          },
          { type: 'endEvent', subType: 'endEvent', name: 'ApprovedEnd' },
          { type: 'endEvent', subType: 'endEvent', name: 'RejectedEnd' },
        ],
        edges: [
          { from: 'Start', to: 'Approve' },
          { from: 'Approve', to: 'ApprovedEnd', condition: 'approve' },
          { from: 'Approve', to: 'RejectedEnd', condition: 'reject' },
        ],
      },
    }),
    'createEnforceWorkflow'
  );

  return workflow.id;
};

const createGatedGlossary = async (
  page: Page,
  reviewers: UserRef[],
  assignees: Record<string, unknown>
): Promise<GatedGlossary> => {
  const { apiContext, afterAction } = await getApiContext(page);
  const glossary = new Glossary(`PwChangeRequest${uuid()}`, reviewers);
  glossary.data.description = PUBLISHED;
  await glossary.create(apiContext);
  const workflowId = await createEnforceWorkflow(
    apiContext,
    glossary.responseData.fullyQualifiedName,
    assignees
  );
  await afterAction();

  return { glossary, workflowId };
};

const deleteGatedGlossary = async (page: Page, gated: GatedGlossary) => {
  const { apiContext, afterAction } = await getApiContext(page);
  await apiContext.delete(
    `/api/v1/governance/workflowDefinitions/${gated.workflowId}?hardDelete=true`
  );
  await gated.glossary.delete(apiContext);
  await afterAction();
};

const publishedDescription = async (page: Page, glossary: Glossary) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const current = await okJson<{ description: string }>(
    await apiContext.get(`/api/v1/glossaries/${glossary.responseData.id}`),
    'publishedDescription'
  );
  await afterAction();

  return current.description;
};

const expectShownDescription = async (page: Page, description: string) => {
  await expect(
    page.getByTestId('asset-description-container').getByRole('paragraph')
  ).toContainText(description);
};

// The requester's edit answers 202: it is held for review, not saved.
const proposeDescription = async (
  page: Page,
  glossary: Glossary,
  description: string
) => {
  await glossary.visitPage(page);
  await page.getByTestId('edit-description').click();
  const descriptionBox = await resolveDescriptionBox(page);
  await descriptionBox.click();
  await descriptionBox.clear();
  await descriptionBox.fill(description);
  const held = waitForResponseWithStatus(
    page,
    isDescriptionPatch(glossary),
    202
  );
  await page.getByTestId('save').click();
  await held;
  await waitForAllLoadersToDisappear(page);
};

const openPendingChanges = async (page: Page, glossary: Glossary) => {
  await glossary.visitPage(page);
  const indicator = page.getByTestId('pending-change-requests');
  await expect(indicator).toContainText('1');
  await indicator.click();
  const dialog = page.getByTestId('review-pending-changes-modal');
  await expect(dialog).toBeVisible();

  return dialog;
};

const submitReview = async (
  page: Page,
  glossary: Glossary,
  decide: 'accept-all' | 'reject-all'
) => {
  const dialog = await openPendingChanges(page, glossary);
  await dialog.getByTestId(decide).click();
  const resolved = waitForResponseWithStatus(page, isResolve, 200);
  await dialog.getByTestId('submit-review').click();
  await resolved;
};

// The description editor stores rich text, so the published value carries its paragraph markup.
const expectPublished = async (
  page: Page,
  glossary: Glossary,
  description: string
) => {
  await expect
    .poll(() => publishedDescription(page, glossary), { timeout: 60_000 })
    .toContain(description);
};

test.describe(
  'Change request review lifecycle',
  { tag: ['@workflow', '@Governance'] },
  () => {
    test('the glossary reviewer approves, rejects and the requester withdraws held edits', async ({
      page,
      dataConsumerPage,
    }) => {
      test.slow();
      await redirectToHomePage(page);
      const reviewer = await loggedInUser(dataConsumerPage);
      const gated = await createGatedGlossary(page, [reviewer], {
        addReviewers: true,
        addOwners: false,
        candidates: [],
      });
      const { glossary } = gated;
      const approved = `Approved description ${uuid()}`;

      try {
        await test.step('a held edit keeps the published value', async () => {
          await proposeDescription(page, glossary, approved);
          await page.reload();
          await waitForAllLoadersToDisappear(page);
          await expectShownDescription(page, PUBLISHED);
          await expect(
            page.getByTestId('pending-change-requests')
          ).toContainText('1');
        });

        await test.step('the reviewer approves and the edit is published', async () => {
          await submitReview(dataConsumerPage, glossary, 'accept-all');
          await expectPublished(page, glossary, approved);
          await glossary.visitPage(page);
          await expectShownDescription(page, approved);
        });

        await test.step('a rejected edit leaves the published value', async () => {
          await proposeDescription(page, glossary, `Rejected ${uuid()}`);
          await submitReview(dataConsumerPage, glossary, 'reject-all');
          await glossary.visitPage(page);
          await expectShownDescription(page, approved);
          await expect(
            page.getByTestId('pending-change-requests')
          ).not.toContainText('1');
          expect(await publishedDescription(page, glossary)).toContain(
            approved
          );
        });

        await test.step('a withdrawn edit leaves the published value', async () => {
          await proposeDescription(page, glossary, `Withdrawn ${uuid()}`);
          const dialog = await openPendingChanges(page, glossary);
          const withdrawn = waitForResponseWithStatus(page, isWithdraw, 200);
          await dialog.locator('[data-testid^="withdraw-"]').click();
          await withdrawn;
          await glossary.visitPage(page);
          await expectShownDescription(page, approved);
          await expect(
            page.getByTestId('pending-change-requests')
          ).not.toContainText('1');
          expect(await publishedDescription(page, glossary)).toContain(
            approved
          );
        });
      } finally {
        await deleteGatedGlossary(page, gated);
      }
    });

    // The assignee neither owns nor reviews the glossary; the workflow alone makes them its reviewer.
    test('a reviewer assigned by the workflow sees and approves the held edit', async ({
      page,
      dataStewardPage,
      dataConsumerPage,
    }) => {
      test.slow();
      await redirectToHomePage(page);
      const reviewer = await loggedInUser(dataStewardPage);
      const assignee = await loggedInUser(dataConsumerPage);
      const gated = await createGatedGlossary(page, [reviewer], {
        addReviewers: false,
        addOwners: false,
        candidates: [assignee],
      });
      const { glossary } = gated;
      const proposed = `Assignee approved ${uuid()}`;

      try {
        await proposeDescription(page, glossary, proposed);
        const dialog = await openPendingChanges(dataConsumerPage, glossary);
        await expect(dialog.getByText(proposed)).toBeVisible();
        await dialog.getByTestId('accept-all').click();
        const resolved = waitForResponseWithStatus(
          dataConsumerPage,
          isResolve,
          200
        );
        await dialog.getByTestId('submit-review').click();
        await resolved;

        await expectPublished(page, glossary, proposed);
      } finally {
        await deleteGatedGlossary(page, gated);
      }
    });
  }
);
