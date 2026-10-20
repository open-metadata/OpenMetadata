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
const createTermAsBot = async (page: Page, term: GlossaryTerm) => {
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
      },
    }),
    'aiGeneratedTerm'
  );
  await botContext.dispose();
};

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

  test('are reviewed from the glossary until someone approves them', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    expect(reviewedInPanel.responseData.entityStatus).toBe('Draft');

    await glossary.visitEntityPage(page);
    const row = getRowByName(page, reviewedInPanel.data.displayName);
    await expect(row.getByTestId('proposal-source-ai')).toBeVisible();
    await expect(
      row.getByTestId(
        `${reviewedInPanel.responseData.fullyQualifiedName}-status`
      )
    ).toContainText('Draft');
    await expect(row.getByTestId('proposal-status-badge')).toBeVisible();
    await expect(page.getByTestId('pending-review-summary')).toBeVisible();
    await expect(
      page.getByTestId(`pending-terms-${glossary.responseData.name}`)
    ).toBeVisible();

    const panel = page.getByTestId('pending-review-panel');
    await expect(panel).toBeVisible();
    // The panel opens one proposal at a time; open this term's unless it is open already.
    const collapsedCard = panel
      .getByTestId('proposal-card')
      .filter({ hasText: reviewedInPanel.data.displayName });
    if ((await collapsedCard.count()) > 0) {
      await collapsedCard.click();
    }
    const card = panel.getByTestId('proposal-card-expanded');
    await expect(card).toContainText(reviewedInPanel.data.displayName);

    const approve = waitForResponseWithStatus(
      page,
      (response) =>
        response.request().method() === 'PATCH' &&
        response
          .url()
          .includes(`/api/v1/glossaryTerms/${reviewedInPanel.responseData.id}`),
      200
    );
    await card.getByTestId('approve-proposal').click();
    await approve;

    await expect(panel.getByTestId('resolved-proposals')).toContainText(
      reviewedInPanel.data.displayName
    );
    await expect(row.getByTestId('proposal-source-ai')).toHaveCount(0);
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
          url.pathname.endsWith('/api/v1/glossaryTerms') &&
          url.searchParams.get('entityStatus') === 'Draft,In Review'
        );
      },
      200
    );
    await glossary.visitEntityPage(page);
    await proposalsLoaded;
    // The other term's row proves the table has rendered its rows before checking an absence.
    await expect(
      getRowByName(page, reviewedInPanel.data.displayName)
    ).toBeVisible();
    await expect(
      getRowByName(page, reviewedOnItsPage.data.displayName)
    ).toHaveCount(0);
    const { apiContext, afterAction } = await getApiContext(page);
    const rejected = await okJson<{ entityStatus: string }>(
      await apiContext.get(
        `/api/v1/glossaryTerms/${reviewedOnItsPage.responseData.id}`
      ),
      'rejectedTerm'
    );
    await afterAction();
    expect(rejected.entityStatus).toBe('Rejected');
    await expect(
      page
        .getByTestId('pending-review-panel')
        .getByText(reviewedOnItsPage.data.displayName)
    ).toHaveCount(0);
  });
});

test('pages a large queue of AI-generated glossary proposals', async ({
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
    const panel = page.getByTestId('pending-review-panel');
    await expect(panel.getByTestId('proposal-card')).toHaveCount(14);
    await expect(panel.getByTestId('proposal-card-expanded')).toBeVisible();

    await panel.getByTestId('next').click();

    await expect(panel.getByTestId('proposal-card')).toHaveCount(0);
    await expect(panel.getByTestId('proposal-card-expanded')).toBeVisible();

    await panel.getByTestId('previous').click();

    await expect(panel.getByTestId('proposal-card')).toHaveCount(14);
  } finally {
    await glossary.delete(apiContext);
    await afterAction();
  }
});
