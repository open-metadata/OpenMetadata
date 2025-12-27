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
import test, { expect, Page } from '@playwright/test';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { createNewPage, redirectToHomePage } from '../../../utils/common';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Voting', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  const testVoting = async (
    page: Page,
    entity: Glossary | GlossaryTerm,
    apiPath: 'glossaries' | 'glossaryTerms'
  ) => {
    await entity.visitEntityPage(page);

    const upvoteButton = page.getByTestId('up-vote-btn');
    const downvoteButton = page.getByTestId('down-vote-btn');

    await expect(upvoteButton).toBeVisible();
    await expect(downvoteButton).toBeVisible();

    const voteResponse1 = page.waitForResponse(`/api/v1/${apiPath}/*/vote`);
    await upvoteButton.click();
    await voteResponse1;

    await expect(upvoteButton).toHaveClass(/\bactive\b/);

    const voteResponse2 = page.waitForResponse(`/api/v1/${apiPath}/*/vote`);
    await downvoteButton.click();
    await voteResponse2;

    await expect(downvoteButton).toHaveClass(/\bactive\b/);
    await expect(upvoteButton).not.toHaveClass(/\bactive\b/);

    const voteResponse3 = page.waitForResponse(`/api/v1/${apiPath}/*/vote`);
    await downvoteButton.click();
    await voteResponse3;

    await expect(downvoteButton).not.toHaveClass(/\bactive\b/);
  };

  test('should upvote, downvote, and remove vote on glossary', async ({
    page,
  }) => {
    await testVoting(page, glossary, 'glossaries');
  });

  test('should upvote, downvote, and remove vote on glossary term', async ({
    page,
  }) => {
    await testVoting(page, glossaryTerm, 'glossaryTerms');
  });

  test('should persist vote after page reload', async ({ page }) => {
    await glossary.visitEntityPage(page);

    const upvoteButton = page.getByTestId('up-vote-btn');
    const voteResponse = page.waitForResponse('/api/v1/glossaries/*/vote');
    await upvoteButton.click();
    await voteResponse;

    await expect(upvoteButton).toHaveClass(/\bactive\b/);

    const reloadResponse = page.waitForResponse(
      '/api/v1/glossaryTerms?directChildrenOf=*'
    );
    await page.reload();
    await reloadResponse;

    await expect(page.getByTestId('up-vote-btn')).toHaveClass(/\bactive\b/);
  });
});
