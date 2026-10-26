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
import { Page, Response } from '@playwright/test';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { okJson } from '../../../utils/apiResponse';
import {
  getApiContext,
  getAuthContext,
  redirectToHomePage,
} from '../../../utils/common';
import { verifyTaskCreated } from '../../../utils/glossary';
import { getRowByName } from '../../../utils/scopedLocators';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { expect, test } from '../../fixtures/pages';

// AI agents write the terms they derive as a bot. The approval workflow sends each one to an
// approval request for its reviewers, else its owners, else the admins, and only that request
// decides it.
const createTermAsBot = async (
  page: Page,
  term: GlossaryTerm,
  owners?: { id: string; type: string }[]
) => {
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
  const botContext = await getAuthContext(auth.config.JWTToken);
  term.responseData = await okJson(
    await botContext.post('/api/v1/glossaryTerms', {
      data: {
        name: term.data.name,
        displayName: term.data.displayName,
        description: term.data.description,
        glossary: term.glossary.responseData.fullyQualifiedName,
        provider: 'automation',
        owners,
      },
    }),
    'aiGeneratedTerm'
  );
  await botContext.dispose();
};

const waitForApprovalRequest = (page: Page, term: GlossaryTerm) =>
  verifyTaskCreated(
    page,
    term.responseData.fullyQualifiedName,
    term.responseData.name
  );

const getApprovalTaskId = async (page: Page, term: GlossaryTerm) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const { data } = await okJson<{ data: { id: string }[] }>(
    await apiContext.get(
      `/api/v1/tasks?aboutEntity=${encodeURIComponent(
        term.responseData.fullyQualifiedName
      )}&status=Open&category=Approval&limit=1`
    ),
    'approvalTask'
  );
  await afterAction();

  return data[0].id;
};

const getEntityStatus = async (page: Page, term: GlossaryTerm) => {
  const { apiContext, afterAction } = await getApiContext(page);
  const { entityStatus } = await okJson<{ entityStatus: string }>(
    await apiContext.get(`/api/v1/glossaryTerms/${term.responseData.id}`),
    'glossaryTerm'
  );
  await afterAction();

  return entityStatus;
};

// The Review tab is the glossary's task list: the approval requests for its terms.
const openReviewTab = async (page: Page) => {
  await page.getByTestId('review').click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByTestId('inbox-tasks-tab')).toBeVisible();
};

const isDecisionOf = (response: Response) =>
  response.request().method() === 'POST' &&
  /\/api\/v1\/tasks\/[^/]+\/resolve$/.test(new URL(response.url()).pathname);

const approveFromReviewTab = async (page: Page, taskId: string) => {
  const row = page.getByTestId(`inbox-task-${taskId}`);
  await row.click();
  const approve = page
    .getByTestId('task-detail-panel')
    .getByTestId('task-approve');
  await expect(approve).toBeEnabled();
  const decided = waitForResponseWithStatus(page, isDecisionOf, 200);
  await approve.click();
  await decided;
  await expect(row).toHaveCount(0);
};

test.describe('AI-generated glossary terms', () => {
  const glossary = new Glossary();
  const reviewedInTab = new GlossaryTerm(glossary);
  const reviewedOnItsPage = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    await glossary.create(apiContext);
    await afterAction();
    await createTermAsBot(page, reviewedInTab);
    await createTermAsBot(page, reviewedOnItsPage);
    await waitForApprovalRequest(page, reviewedInTab);
    await waitForApprovalRequest(page, reviewedOnItsPage);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    await glossary.delete(apiContext);
    await afterAction();
    await page.close();
  });

  test('are approved from the Review tab', async ({ page }) => {
    await redirectToHomePage(page);
    const taskId = await getApprovalTaskId(page, reviewedInTab);

    await glossary.visitEntityPage(page);
    // The terms table marks the proposal and, as for a person's, offers its assignees the
    // decision of its approval request; the Review tab decides it here.
    const row = getRowByName(page, reviewedInTab.data.displayName);
    await expect(row.getByTestId('proposal-source-ai')).toBeVisible();
    await expect(
      row.getByTestId(`${reviewedInTab.data.name}-approve-btn`)
    ).toBeVisible();

    await openReviewTab(page);
    await approveFromReviewTab(page, taskId);

    await expect
      .poll(() => getEntityStatus(page, reviewedInTab))
      .toBe('Approved');
  });

  test('are rejected on their own page', async ({ page }) => {
    await redirectToHomePage(page);
    await reviewedOnItsPage.visitEntityPage(page);
    const card = page.getByTestId('ai-generated-term-card');
    await expect(card).toBeVisible();

    await card.getByTestId('reject-proposal').click();
    await card
      .getByTestId('proposal-rejection-reason')
      .getByRole('textbox')
      .fill('Covered by an existing term');
    const reject = waitForResponseWithStatus(page, isDecisionOf, 200);
    await card.getByTestId('confirm-reject-proposal').click();
    await reject;

    await expect(card).toBeHidden();
    await expect(page.getByTestId('glossary-header')).toContainText('Rejected');
    expect(await getEntityStatus(page, reviewedOnItsPage)).toBe('Rejected');
  });
});

test('a term owner decides an AI proposal from the Review tab without editing its glossary', async ({
  page,
  ownerPage,
}) => {
  const glossary = new Glossary();
  const term = new GlossaryTerm(glossary);
  await redirectToHomePage(page);
  await redirectToHomePage(ownerPage);
  const { apiContext, afterAction } = await getApiContext(page);
  const { apiContext: ownerApi, afterAction: afterOwnerAction } =
    await getApiContext(ownerPage);

  try {
    await glossary.create(apiContext);
    const owner = await okJson<{ id: string; name: string }>(
      await ownerApi.get('/api/v1/users/loggedInUser'),
      'termOwner'
    );
    await createTermAsBot(page, term, [{ id: owner.id, type: 'user' }]);
    await waitForApprovalRequest(page, term);
    const parentPermission = await okJson<{
      permissions: { operation: string; access: string }[];
    }>(
      await ownerApi.get(
        `/api/v1/permissions/glossary/${glossary.responseData.id}`
      ),
      'glossaryPermission'
    );
    expect(parentPermission.permissions).not.toContainEqual(
      expect.objectContaining({ operation: 'EditAll', access: 'allow' })
    );
    const taskId = await getApprovalTaskId(page, term);

    await glossary.visitEntityPage(ownerPage);
    await openReviewTab(ownerPage);
    await approveFromReviewTab(ownerPage, taskId);

    await expect.poll(() => getEntityStatus(page, term)).toBe('Approved');
  } finally {
    await glossary.delete(apiContext);
    await afterOwnerAction();
    await afterAction();
  }
});
