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
import test, { expect } from '@playwright/test';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage, redirectToHomePage } from '../../utils/common';

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

  test('should upvote glossary', async ({ page }) => {
    await glossary.visitEntityPage(page);

    const upvoteButton = page.getByTestId('up-vote-btn');

    await expect(upvoteButton).toBeVisible();

    // Click upvote
    const voteResponse = page.waitForResponse('/api/v1/glossaries/*/vote');
    await upvoteButton.click();
    await voteResponse;

    // Verify vote count increased
    await expect(upvoteButton).toHaveClass(/\bactive\b/);
  });

  test('should downvote glossary', async ({ page }) => {
    await glossary.visitEntityPage(page);

    const downvoteButton = page.getByTestId('down-vote-btn');

    await expect(downvoteButton).toBeVisible();

    // Click downvote
    const voteResponse = page.waitForResponse('/api/v1/glossaries/*/vote');
    await downvoteButton.click();
    await voteResponse;

    // Verify downvote is active
    await expect(downvoteButton).toHaveClass(/\bactive\b/);
  });

  test('should change vote on glossary from upvote to downvote', async ({
    page,
  }) => {
    await glossary.visitEntityPage(page);

    const upvoteButton = page.getByTestId('up-vote-btn');
    const downvoteButton = page.getByTestId('down-vote-btn');

    // First upvote
    const voteResponse1 = page.waitForResponse('/api/v1/glossaries/*/vote');
    await upvoteButton.click();
    await voteResponse1;

    await expect(upvoteButton).toHaveClass(/\bactive\b/);

    // Then change to downvote
    const voteResponse2 = page.waitForResponse('/api/v1/glossaries/*/vote');
    await downvoteButton.click();
    await voteResponse2;

    // Verify downvote is now active and upvote is not
    await expect(downvoteButton).toHaveClass(/\bactive\b/);
    await expect(upvoteButton).not.toHaveClass(/\bactive\b/);
  });

  test('should remove vote on glossary by clicking again', async ({ page }) => {
    await glossary.visitEntityPage(page);

    const upvoteButton = page.getByTestId('up-vote-btn');

    // First upvote
    const voteResponse1 = page.waitForResponse('/api/v1/glossaries/*/vote');
    await upvoteButton.click();
    await voteResponse1;

    await expect(upvoteButton).toHaveClass(/\bactive\b/);

    // Click again to remove vote
    const voteResponse2 = page.waitForResponse('/api/v1/glossaries/*/vote');
    await upvoteButton.click();
    await voteResponse2;

    // Verify vote is removed
    await expect(upvoteButton).not.toHaveClass(/\bactive\b/);
  });

  test('should upvote glossary term', async ({ page }) => {
    await glossaryTerm.visitEntityPage(page);

    const upvoteButton = page.getByTestId('up-vote-btn');

    await expect(upvoteButton).toBeVisible();

    // Click upvote
    const voteResponse = page.waitForResponse('/api/v1/glossaryTerms/*/vote');
    await upvoteButton.click();
    await voteResponse;

    // Verify vote is active
    await expect(upvoteButton).toHaveClass(/\bactive\b/);
  });

  test('should downvote glossary term', async ({ page }) => {
    await glossaryTerm.visitEntityPage(page);

    const downvoteButton = page.getByTestId('down-vote-btn');

    await expect(downvoteButton).toBeVisible();

    // Click downvote
    const voteResponse = page.waitForResponse('/api/v1/glossaryTerms/*/vote');
    await downvoteButton.click();
    await voteResponse;

    // Verify downvote is active
    await expect(downvoteButton).toHaveClass(/\bactive\b/);
  });

  test('should persist vote after page reload', async ({ page }) => {
    await glossary.visitEntityPage(page);

    const upvoteButton = page.getByTestId('up-vote-btn');

    // First upvote
    const voteResponse = page.waitForResponse('/api/v1/glossaries/*/vote');
    await upvoteButton.click();
    await voteResponse;

    await expect(upvoteButton).toHaveClass(/\bactive\b/);

    // Reload page and wait for vote button to be visible
    const reloadResponse = page.waitForResponse('/api/v1/glossaries/*');
    await page.reload();
    await reloadResponse;

    // Verify vote persists
    const upvoteButtonAfterReload = page.getByTestId('up-vote-btn');

    await expect(upvoteButtonAfterReload).toHaveClass(/\bactive\b/);
  });
});
