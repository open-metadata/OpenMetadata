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
import { Page } from '@playwright/test';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { okJson } from '../../../utils/apiResponse';
import {
  getApiContext,
  getAuthContext,
  redirectToHomePage,
} from '../../../utils/common';
import { getRowByName } from '../../../utils/scopedLocators';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { expect, test } from '../../fixtures/pages';

// AI agents write the terms they derive as a bot, and bot writes never start the approval
// workflow, so the term waits in Draft for a person.
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

// The Review tab lists every proposal under the glossary; the Terms tab only links to it.
const openReviewTab = async (page: Page) => {
  await page.getByTestId('review').click();
  await expect(page.getByTestId('review-queue')).toBeVisible();
};

const queueItem = (page: Page, name: string) =>
  page
    .getByTestId('review-queue')
    .getByTestId('review-queue-item')
    .filter({ hasText: name });

test.describe('AI-generated glossary terms', () => {
  const glossary = new Glossary();
  const reviewedInPanel = new GlossaryTerm(glossary);
  const reviewedOnItsPage = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    await glossary.create(apiContext);
    await afterAction();
    await createTermAsBot(page, reviewedInPanel);
    await createTermAsBot(page, reviewedOnItsPage);
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

  test('are reviewed from the Review tab until someone approves them', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    expect(reviewedInPanel.responseData.entityStatus).toBe('Draft');

    await glossary.visitEntityPage(page);
    // The terms table marks the proposal; the Review tab decides it.
    const row = getRowByName(page, reviewedInPanel.data.displayName);
    await expect(row.getByTestId('proposal-source-ai')).toBeVisible();
    await expect(row.getByTestId('proposal-status-badge')).toContainText(
      'Proposed by AI'
    );
    await expect(page.getByTestId('pending-review-summary')).toHaveCount(0);

    await openReviewTab(page);

    await expect(page).toHaveURL(/\/review$/);
    await queueItem(page, reviewedInPanel.data.displayName)
      .getByRole('button')
      .click();
    const detail = page.getByTestId('proposal-detail');
    await expect(detail).toContainText(reviewedInPanel.data.displayName);
    await expect(detail.getByTestId('reject-proposal')).toBeInViewport({
      ratio: 1,
    });

    const approve = waitForResponseWithStatus(
      page,
      (response) =>
        response.request().method() === 'PATCH' &&
        response
          .url()
          .includes(`/api/v1/glossaryTerms/${reviewedInPanel.responseData.id}`),
      200
    );
    await detail.getByTestId('approve-proposal').click();
    await approve;

    await expect(page.getByTestId('resolved-proposals')).toContainText(
      reviewedInPanel.data.displayName
    );
    await expect(queueItem(page, reviewedInPanel.data.displayName)).toHaveCount(
      0
    );
  });

  test('are reviewed on their own page', async ({ page }) => {
    await redirectToHomePage(page);
    await reviewedOnItsPage.visitEntityPage(page);
    const card = page.getByTestId('ai-generated-term-card');
    await expect(card).toBeVisible();

    const reject = waitForResponseWithStatus(
      page,
      (response) =>
        response.request().method() === 'PATCH' &&
        response
          .url()
          .includes(
            `/api/v1/glossaryTerms/${reviewedOnItsPage.responseData.id}`
          ),
      200
    );
    await card.getByTestId('reject-proposal').click();
    await reject;

    await expect(card).toBeHidden();
    await expect(page.getByTestId('glossary-header')).toContainText('Rejected');

    // A rejected draft leaves the review queue.
    const proposalsLoaded = waitForResponseWithStatus(
      page,
      (response) => {
        const url = new URL(response.url());

        return (
          url.pathname.endsWith('/api/v1/glossaryTerms/search') &&
          url.searchParams.get('entityStatus') === 'Draft,In Review'
        );
      },
      200
    );
    await glossary.visitEntityPage(page);
    await proposalsLoaded;
    await page.getByTestId('review').click();
    await expect(page.getByTestId('glossary-review-tab')).toBeVisible();
    await expect(queueItem(page, reviewedOnItsPage.data.displayName)).toHaveCount(
      0
    );
    const { apiContext, afterAction } = await getApiContext(page);
    const rejected = await okJson<{ entityStatus: string }>(
      await apiContext.get(
        `/api/v1/glossaryTerms/${reviewedOnItsPage.responseData.id}`
      ),
      'rejectedTerm'
    );
    await afterAction();
    expect(rejected.entityStatus).toBe('Rejected');
  });
});

test('loads a large queue of AI-generated glossary proposals a page at a time', async ({
  page,
}) => {
  const glossary = new Glossary();
  const terms = Array.from({ length: 16 }, () => new GlossaryTerm(glossary));
  await redirectToHomePage(page);
  const { apiContext, afterAction } = await getApiContext(page);
  await glossary.create(apiContext);

  try {
    for (const term of terms) {
      await createTermAsBot(page, term);
    }
    await glossary.visitEntityPage(page);
    await openReviewTab(page);
    const items = page.getByTestId('review-queue-item');
    await expect(items).toHaveCount(15);

    await page.getByTestId('review-queue-load-more').click();

    await expect(items).toHaveCount(16);
    await expect(page.getByTestId('review-queue-load-more')).toHaveCount(0);
  } finally {
    await glossary.delete(apiContext);
    await afterAction();
  }
});

test('a term owner can review an AI draft without editing its glossary', async ({
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

    await glossary.visitEntityPage(ownerPage);
    await openReviewTab(ownerPage);
    const card = ownerPage.getByTestId('proposal-detail');
    await expect(card).toContainText(term.data.displayName);
    const approved = waitForResponseWithStatus(
      ownerPage,
      (response) =>
        response.request().method() === 'PATCH' &&
        response
          .url()
          .includes(`/api/v1/glossaryTerms/${term.responseData.id}`),
      200
    );
    await card.getByTestId('approve-proposal').click();
    await approved;
    await expect(ownerPage.getByTestId('resolved-proposals')).toContainText(
      term.data.displayName
    );
    const stored = await okJson<{ entityStatus: string }>(
      await ownerApi.get(`/api/v1/glossaryTerms/${term.responseData.id}`),
      'approvedOwnedTerm'
    );
    expect(stored.entityStatus).toBe('Approved');
  } finally {
    await glossary.delete(apiContext);
    await afterOwnerAction();
    await afterAction();
  }
});
