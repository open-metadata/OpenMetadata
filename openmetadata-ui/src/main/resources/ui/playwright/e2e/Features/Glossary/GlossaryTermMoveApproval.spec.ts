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
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { okJson } from '../../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { pickGlossaryTermInField } from '../../../utils/glossaryPicker';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { expect, test } from '../../fixtures/pages';

/**
 * Moving a glossary term with Change Parent is the same edit as dragging it: an Enforce-mode
 * workflow watching the term's parent holds the move for its reviewer, and the term stays where it
 * is until the reviewer accepts it (ADR:2026-10-30-a-glossary-term-move-is-authorized-and-held-as-the-patch-that-makes-it).
 */

type UserRef = { id: string; name: string; type: 'user' };

type MoveSetup = {
  glossary: Glossary;
  target: GlossaryTerm;
  moved: GlossaryTerm;
  child: GlossaryTerm;
  workflowId: string;
};

const loggedInUser = async (page: Page): Promise<UserRef> => {
  await redirectToHomePage(page);
  const { apiContext, afterAction } = await getApiContext(page);
  const user = await okJson<{ id: string; name: string }>(
    await apiContext.get('/api/v1/users/loggedInUser'),
    'loggedInUser'
  );
  await afterAction();

  return { id: user.id, name: user.name, type: 'user' };
};

const termById = async (apiContext: APIRequestContext, term: GlossaryTerm) =>
  okJson<{ fullyQualifiedName: string; entityStatus?: string }>(
    await apiContext.get(`/api/v1/glossaryTerms/${term.responseData.id}`),
    'termById'
  );

// Holds parent and glossary edits on the one term the test moves; matched by id, since a move
// rewrites the fully qualified name the gate judges its filter on.
const createMoveGate = async (
  apiContext: APIRequestContext,
  term: GlossaryTerm
) =>
  okJson<{ id: string }>(
    await apiContext.post('/api/v1/governance/workflowDefinitions', {
      data: {
        name: `PwTermMoveGate${uuid()}`,
        displayName: 'Playwright term move gate',
        description: 'Holds moves of one glossary term for its reviewer.',
        config: { storeStageStatus: true },
        trigger: {
          type: 'eventBasedEntity',
          config: {
            approvalMode: 'Enforce',
            entityTypes: ['glossaryTerm'],
            events: ['Updated'],
            include: ['parent', 'glossary'],
            exclude: [],
            filter: {
              glossaryTerm: JSON.stringify({
                '!=': [{ var: 'id' }, term.responseData.id],
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
              assignees: {
                addReviewers: true,
                addOwners: false,
                candidates: [],
              },
              approvalThreshold: 1,
              rejectionThreshold: 1,
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
    'createMoveGate'
  );

// Waits for the seeded glossary approval to settle a new term: a move submitted before that write
// lands is refused as a concurrent change.
const awaitStatus = async (
  apiContext: APIRequestContext,
  term: GlossaryTerm,
  status: string | RegExp
) =>
  expect
    .poll(async () => (await termById(apiContext, term)).entityStatus, {
      timeout: 60_000,
    })
    .toMatch(status);

// Only the moved term has a reviewer: it is the one the gate assigns, and every other term is
// Approved, which the parent picker requires of a target.
const setUpMove = async (page: Page, reviewer: UserRef): Promise<MoveSetup> => {
  const { apiContext, afterAction } = await getApiContext(page);
  const id = uuid();
  const glossary = new Glossary(`PwMoveGate${id}`);
  await glossary.create(apiContext);
  const source = new GlossaryTerm(glossary, undefined, `Revenue${id}`);
  const target = new GlossaryTerm(glossary, undefined, `Costs${id}`);
  await source.create(apiContext);
  await target.create(apiContext);
  const moved = new GlossaryTerm(
    glossary,
    source.responseData.fullyQualifiedName,
    `NetRevenue${id}`
  );
  await moved.create(apiContext);
  await awaitStatus(apiContext, moved, 'Approved');
  await okJson(
    await apiContext.patch(`/api/v1/glossaryTerms/${moved.responseData.id}`, {
      data: [{ op: 'add', path: '/reviewers', value: [reviewer] }],
      headers: { 'Content-Type': 'application/json-patch+json' },
    }),
    'addReviewer'
  );
  const child = new GlossaryTerm(
    glossary,
    moved.responseData.fullyQualifiedName,
    `Recognized${id}`
  );
  await child.create(apiContext);
  await awaitStatus(apiContext, source, 'Approved');
  await awaitStatus(apiContext, target, 'Approved');
  await awaitStatus(apiContext, moved, 'In Review');
  // Whether the child inherits the moved term's reviewer does not matter here, only that it settled.
  await awaitStatus(apiContext, child, /^(Approved|In Review)$/);
  const workflow = await createMoveGate(apiContext, moved);
  await afterAction();

  return { glossary, target, moved, child, workflowId: workflow.id };
};

const tearDownMove = async (page: Page, setup: MoveSetup) => {
  const { apiContext, afterAction } = await getApiContext(page);
  await apiContext.delete(
    `/api/v1/governance/workflowDefinitions/${setup.workflowId}?hardDelete=true`
  );
  await setup.glossary.delete(apiContext);
  await afterAction();
};

const isMoveRequest = (term: GlossaryTerm) => (response: Response) =>
  response.request().method() === 'PUT' &&
  response
    .url()
    .includes(`/api/v1/glossaryTerms/${term.responseData.id}/moveAsync`);

const visitTerm = async (page: Page, term: GlossaryTerm) => {
  await page.goto(
    `/glossary/${encodeURIComponent(term.responseData.fullyQualifiedName)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('entity-header-name')).toContainText(
    term.responseData.name
  );
};

test.describe(
  'Glossary term move held for approval',
  { tag: ['@workflow', '@Governance'] },
  () => {
    test('Change Parent is held for the reviewer and applied once accepted', async ({
      page,
      dataConsumerPage,
    }) => {
      test.slow();
      const reviewer = await loggedInUser(dataConsumerPage);
      await redirectToHomePage(page);
      const setup = await setUpMove(page, reviewer);
      const { target, moved, child } = setup;
      const movedFqn = `${target.responseData.fullyQualifiedName}.${moved.responseData.name}`;

      try {
        await test.step('the move is held and the term stays where it is', async () => {
          await visitTerm(page, moved);
          await page.getByTestId('manage-button').click();
          await page.getByTestId('change-parent-button').click();
          const modal = page.getByTestId('change-parent-hierarchy-modal');
          await expect(modal).toBeVisible();
          await pickGlossaryTermInField(
            page,
            modal.getByTestId('change-parent-select'),
            {
              name: target.responseData.name,
              displayName: target.responseData.displayName,
              fullyQualifiedName: target.responseData.fullyQualifiedName,
            }
          );
          await modal.getByTestId('confirm-status-checkbox').click();
          const held = waitForResponseWithStatus(
            page,
            isMoveRequest(moved),
            202
          );
          await clickIgnoringToasts(modal.getByTestId('save-button'));
          const response = await held;

          expect(
            response.headers()['x-openmetadata-pending-change']
          ).toBeTruthy();
          await toastNotification(page, /submitted for approval/);
          await expect(modal).toBeHidden();

          const { apiContext, afterAction } = await getApiContext(page);
          expect((await termById(apiContext, moved)).fullyQualifiedName).toBe(
            moved.responseData.fullyQualifiedName
          );
          await afterAction();
        });

        await test.step('the reviewer accepts and the term moves with its child', async () => {
          await visitTerm(dataConsumerPage, moved);
          const indicator = dataConsumerPage.getByTestId(
            'pending-change-requests'
          );
          await expect(indicator).toContainText('1');
          await indicator.click();
          const dialog = dataConsumerPage.getByTestId(
            'review-pending-changes-modal'
          );
          await expect(dialog).toBeVisible();
          await expect(dialog).toContainText(
            target.responseData.fullyQualifiedName
          );
          await dialog.getByTestId('accept-all').click();
          const resolved = waitForResponseWithStatus(
            dataConsumerPage,
            (res) =>
              /\/api\/v1\/tasks\/[^/]+\/resolve/.test(res.url()) &&
              res.request().method() === 'POST',
            200
          );
          await clickIgnoringToasts(dialog.getByTestId('submit-review'));
          await resolved;

          const { apiContext, afterAction } = await getApiContext(page);
          await expect
            .poll(
              async () =>
                (
                  await termById(apiContext, moved)
                ).fullyQualifiedName,
              { timeout: 60_000 }
            )
            .toBe(movedFqn);
          expect((await termById(apiContext, child)).fullyQualifiedName).toBe(
            `${movedFqn}.${child.responseData.name}`
          );
          await afterAction();
        });
      } finally {
        await tearDownMove(page, setup);
      }
    });
  }
);
