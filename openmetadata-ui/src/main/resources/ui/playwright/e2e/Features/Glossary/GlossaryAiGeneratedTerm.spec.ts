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
  const term = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    await glossary.create(apiContext);
    await afterAction();
    await createTermAsBot(page, term);
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

  test('stays highlighted as a draft until someone approves it', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    expect(term.responseData.entityStatus).toBe('Draft');

    await glossary.visitEntityPage(page);
    await expect(
      getRowByName(page, term.data.displayName).getByTestId(
        'ai-generated-term-badge'
      )
    ).toBeVisible();

    await term.visitEntityPage(page);
    const card = page.getByTestId('ai-generated-term-card');
    await expect(card).toBeVisible();

    const approve = waitForResponseWithStatus(
      page,
      (response) =>
        response.request().method() === 'PATCH' &&
        response
          .url()
          .includes(`/api/v1/glossaryTerms/${term.responseData.id}`),
      200
    );
    await card.getByTestId('approve-ai-generated-term').click();
    await approve;

    await expect(card).toBeHidden();
    await expect(page.getByTestId('glossary-header')).toContainText('Approved');

    await glossary.visitEntityPage(page);
    const approvedRow = getRowByName(page, term.data.displayName);
    await expect(approvedRow).toBeVisible();
    await expect(
      approvedRow.getByTestId('ai-generated-term-badge')
    ).toHaveCount(0);
  });
});
