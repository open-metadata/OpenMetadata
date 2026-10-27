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
import { APIRequestContext, Locator, Page, Response } from '@playwright/test';
import { EntityTypeEndpoint } from '../../../support/entity/Entity.interface';
import { Glossary } from '../../../support/glossary/Glossary';
import { okJson } from '../../../utils/apiResponse';
import {
  clickIgnoringToasts,
  fillDescriptionBox,
  getApiContext,
  getAuthContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import { assignTag, waitForAllLoadersToDisappear } from '../../../utils/entity';
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

const isGlossaryPatch = (glossary: Glossary) => (response: Response) =>
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
  assignees: Record<string, unknown>,
  approvalThreshold: number
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
              approvalThreshold,
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
  assignees: Record<string, unknown>,
  approvalThreshold = 1
): Promise<GatedGlossary> => {
  const { apiContext, afterAction } = await getApiContext(page);
  const glossary = new Glossary(`PwChangeRequest${uuid()}`, reviewers);
  glossary.data.description = PUBLISHED;
  await glossary.create(apiContext);
  const workflowId = await createEnforceWorkflow(
    apiContext,
    glossary.responseData.fullyQualifiedName,
    assignees,
    approvalThreshold
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

// By URL rather than the sidebar list, which the role pages cannot all reach and other specs crowd.
// The indicator's read of the glossary's change requests: until it lands, an absent
// Pending Changes button says nothing about whether a request is open.
const isChangeRequestsRead = (glossary: Glossary) => (response: Response) => {
  const url = new URL(response.url());

  return (
    response.request().method() === 'GET' &&
    url.pathname.endsWith('/api/v1/changeRequests') &&
    url.searchParams.get('entityId') === glossary.responseData.id
  );
};

const visitGlossary = async (page: Page, glossary: Glossary) => {
  const requestsRead = waitForResponseWithStatus(
    page,
    isChangeRequestsRead(glossary),
    200
  );
  await page.goto(
    `/glossary/${encodeURIComponent(glossary.responseData.fullyQualifiedName)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await requestsRead;
  await expect(page.getByTestId('entity-header-display-name')).toHaveText(
    glossary.responseData.displayName
  );
  await waitForAllLoadersToDisappear(page);
};

const expectShownDescription = async (page: Page, description: string) => {
  await expect(
    page.getByTestId('asset-description-container').getByRole('paragraph')
  ).toContainText(description);
};

// A gated edit answers 202: it is held for review, not saved. An ungated one answers 200.
const editDescription = async (
  page: Page,
  glossary: Glossary,
  description: string,
  status: 200 | 202
) => {
  await visitGlossary(page, glossary);
  await page.getByTestId('edit-description').click();
  await fillDescriptionBox(page, description);
  const saved = waitForResponseWithStatus(
    page,
    isGlossaryPatch(glossary),
    status
  );
  await clickIgnoringToasts(page.getByTestId('save'));
  await saved;
  await waitForAllLoadersToDisappear(page);
};

const proposeDescription = (
  page: Page,
  glossary: Glossary,
  description: string
) => editDescription(page, glossary, description, 202);

// The indicator counts the requests the viewer can see; with none it is not shown.
const expectNoPendingCount = async (page: Page) => {
  await expect(page.getByTestId('pending-change-requests')).toHaveCount(0);
};

const openPendingChanges = async (
  page: Page,
  glossary: Glossary,
  count = '1'
) => {
  await visitGlossary(page, glossary);
  const indicator = page.getByTestId('pending-change-requests');
  await expect(indicator).toContainText(count);
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
  await clickIgnoringToasts(dialog.getByTestId('submit-review'));
  await resolved;
};

// A suggestion row in the dialog, found by the unique token in the text it proposes.
const suggestionRow = (dialog: Locator, token: string) =>
  dialog.getByTestId(/^suggestion-/).filter({ hasText: token });

const requestStatus = async (
  page: Page,
  glossary: Glossary,
  requestedBy: string
) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const { data } = await okJson<{
    data: { requestedBy: string; status: string }[];
  }>(
    await apiContext.get(
      `/api/v1/changeRequests?entityId=${glossary.responseData.id}&limit=50`
    ),
    'requestStatus'
  );
  await afterAction();

  return data.find((request) => request.requestedBy === requestedBy)?.status;
};

// Bots write past the approval gate, the way ingestion publishes metadata.
const botApiContext = async (page: Page) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const bot = await okJson<{ botUser: { id: string } }>(
    await apiContext.get('/api/v1/bots/name/ingestion-bot'),
    'ingestionBot'
  );
  const auth = await okJson<{ config: { JWTToken: string } }>(
    await apiContext.get(`/api/v1/users/auth-mechanism/${bot.botUser.id}`),
    'ingestionBotToken'
  );
  await afterAction();

  return getAuthContext(auth.config.JWTToken);
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
          await visitGlossary(page, glossary);
          await expectShownDescription(page, approved);
        });

        await test.step('a rejected edit leaves the published value', async () => {
          await proposeDescription(page, glossary, `Rejected ${uuid()}`);
          await submitReview(dataConsumerPage, glossary, 'reject-all');
          await visitGlossary(page, glossary);
          await expectShownDescription(page, approved);
          await expectNoPendingCount(page);
          expect(await publishedDescription(page, glossary)).toContain(
            approved
          );
        });

        await test.step('a withdrawn edit leaves the published value', async () => {
          await proposeDescription(page, glossary, `Withdrawn ${uuid()}`);
          const dialog = await openPendingChanges(page, glossary);
          const withdrawn = waitForResponseWithStatus(page, isWithdraw, 200);
          await clickIgnoringToasts(
            dialog.getByRole('button', { name: 'Withdraw revision' })
          );
          await withdrawn;
          await visitGlossary(page, glossary);
          await expectShownDescription(page, approved);
          await expectNoPendingCount(page);
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
        await clickIgnoringToasts(dialog.getByTestId('submit-review'));
        await resolved;

        await expectPublished(page, glossary, proposed);
      } finally {
        await deleteGatedGlossary(page, gated);
      }
    });

    test('edits the workflow does not gate publish at once', async ({
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
      const ungoverned = new Glossary(`PwChangeRequestFree${uuid()}`);
      const { apiContext, afterAction } = await getApiContext(page);
      await ungoverned.create(apiContext);
      await afterAction();
      const direct = `Direct description ${uuid()}`;

      try {
        await test.step('a tag edit on the gated glossary is published', async () => {
          await visitGlossary(page, glossary);
          const published = waitForResponseWithStatus(
            page,
            isGlossaryPatch(glossary),
            200
          );
          await assignTag(
            page,
            'Personal',
            'Add',
            EntityTypeEndpoint.Glossary,
            'KnowledgePanel.Tags',
            'PersonalData.Personal'
          );
          await published;
          await expectNoPendingCount(page);
        });

        await test.step('a description edit on a glossary the filter leaves out is published', async () => {
          await editDescription(page, ungoverned, direct, 200);
          await expectShownDescription(page, direct);
          await expectNoPendingCount(page);
          expect(await publishedDescription(page, ungoverned)).toContain(
            direct
          );
        });
      } finally {
        const cleanup = await getApiContext(page);
        await ungoverned.delete(cleanup.apiContext);
        await cleanup.afterAction();
        await deleteGatedGlossary(page, gated);
      }
    });

    test('only the reviewers see every held edit; a requester sees their own', async ({
      page,
      dataConsumerPage,
      dataStewardPage,
      viewOnlyPage,
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
      const adminToken = uuid();
      const requesterToken = uuid();

      try {
        await proposeDescription(page, glossary, `Admin edit ${adminToken}`);
        await proposeDescription(
          dataStewardPage,
          glossary,
          `Requester edit ${requesterToken}`
        );

        await test.step('a viewer outside the review sees no held edit', async () => {
          await visitGlossary(viewOnlyPage, glossary);
          await expectNoPendingCount(viewOnlyPage);
        });

        await test.step('the requester sees only their own edit, to withdraw', async () => {
          const dialog = await openPendingChanges(dataStewardPage, glossary);
          await expect(suggestionRow(dialog, requesterToken)).toBeVisible();
          await expect(
            suggestionRow(dialog, requesterToken).getByRole('button', {
              name: 'Withdraw revision',
            })
          ).toBeVisible();
          await expect(suggestionRow(dialog, adminToken)).toHaveCount(0);
          await expect(
            dialog.getByRole('button', { name: 'Accept', exact: true })
          ).toHaveCount(0);
        });

        await test.step('the reviewer sees both edits', async () => {
          const dialog = await openPendingChanges(
            dataConsumerPage,
            glossary,
            '2'
          );
          await expect(suggestionRow(dialog, adminToken)).toBeVisible();
          await expect(suggestionRow(dialog, requesterToken)).toBeVisible();
        });
      } finally {
        await deleteGatedGlossary(page, gated);
      }
    });

    // Both reviewers hold the DataConsumer role, whose TaskAuthorPolicy lets a task's reviewers resolve it.
    test('an edit that needs two approvals is published only after the second', async ({
      page,
      dataConsumerPage,
      ownerPage,
    }) => {
      test.slow();
      await redirectToHomePage(page);
      const reviewers = [
        await loggedInUser(dataConsumerPage),
        await loggedInUser(ownerPage),
      ];
      const gated = await createGatedGlossary(
        page,
        reviewers,
        { addReviewers: true, addOwners: false, candidates: [] },
        2
      );
      const { glossary } = gated;
      const proposed = `Twice approved ${uuid()}`;

      try {
        await proposeDescription(page, glossary, proposed);

        await test.step('the first approval leaves the edit held', async () => {
          await submitReview(dataConsumerPage, glossary, 'accept-all');
          const dialog = await openPendingChanges(dataConsumerPage, glossary);
          await expect(
            dialog.getByText(
              'You voted: Accepted · waiting for other reviewers'
            )
          ).toBeVisible();
          await visitGlossary(page, glossary);
          await expectShownDescription(page, PUBLISHED);
          expect(await publishedDescription(page, glossary)).toContain(
            PUBLISHED
          );
        });

        await test.step('the second approval publishes it', async () => {
          await submitReview(ownerPage, glossary, 'accept-all');
          await expectPublished(page, glossary, proposed);
          await visitGlossary(page, glossary);
          await expectShownDescription(page, proposed);
        });
      } finally {
        await deleteGatedGlossary(page, gated);
      }
    });

    test('accepting one of two competing edits supersedes the other', async ({
      page,
      dataConsumerPage,
      dataStewardPage,
    }) => {
      test.slow();
      await redirectToHomePage(page);
      const reviewer = await loggedInUser(dataConsumerPage);
      const requester = await loggedInUser(dataStewardPage);
      const gated = await createGatedGlossary(page, [reviewer], {
        addReviewers: true,
        addOwners: false,
        candidates: [],
      });
      const { glossary } = gated;
      const winner = `Winning edit ${uuid()}`;
      const loserToken = uuid();

      try {
        await proposeDescription(page, glossary, winner);
        await proposeDescription(
          dataStewardPage,
          glossary,
          `Losing edit ${loserToken}`
        );

        const dialog = await openPendingChanges(
          dataConsumerPage,
          glossary,
          '2'
        );
        await expect(
          dialog.getByText('Competing edits · accept one')
        ).toBeVisible();
        await expect(dialog.getByTestId('accept-all')).toHaveCount(0);

        await suggestionRow(dialog, winner)
          .getByRole('button', { name: 'Accept', exact: true })
          .click();
        await expect(suggestionRow(dialog, loserToken)).toContainText(
          'Superseded · pending submit'
        );
        const resolved = waitForResponseWithStatus(
          dataConsumerPage,
          isResolve,
          200
        );
        await clickIgnoringToasts(dialog.getByTestId('submit-review'));
        await resolved;

        await expectPublished(page, glossary, winner);
        await expect
          .poll(() => requestStatus(page, glossary, requester.name), {
            timeout: 30_000,
          })
          .toBe('Superseded');
        await visitGlossary(page, glossary);
        await expectShownDescription(page, winner);
        await expectNoPendingCount(page);
      } finally {
        await deleteGatedGlossary(page, gated);
      }
    });

    test('a bot writing the field supersedes the held edit', async ({
      page,
      dataConsumerPage,
    }) => {
      test.slow();
      await redirectToHomePage(page);
      const requester = await loggedInUser(page);
      const reviewer = await loggedInUser(dataConsumerPage);
      const gated = await createGatedGlossary(page, [reviewer], {
        addReviewers: true,
        addOwners: false,
        candidates: [],
      });
      const { glossary } = gated;
      const botWritten = `Written by ingestion ${uuid()}`;

      try {
        await proposeDescription(page, glossary, `Held edit ${uuid()}`);

        const bot = await botApiContext(page);
        const response = await bot.patch(
          `/api/v1/glossaries/${glossary.responseData.id}`,
          {
            data: [{ op: 'replace', path: '/description', value: botWritten }],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
        await bot.dispose();
        expect(response.status()).toBe(200);

        await expectPublished(page, glossary, botWritten);
        await expect
          .poll(() => requestStatus(page, glossary, requester.name), {
            timeout: 30_000,
          })
          .toBe('Superseded');
        await visitGlossary(page, glossary);
        await expectShownDescription(page, botWritten);
        await expectNoPendingCount(page);
      } finally {
        await deleteGatedGlossary(page, gated);
      }
    });
  }
);
