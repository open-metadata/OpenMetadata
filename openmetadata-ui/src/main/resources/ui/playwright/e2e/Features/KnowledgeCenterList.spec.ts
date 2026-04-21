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
import { expect, test } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  getKnowledgePageCardByIndex,
  getKnowledgePageCardEntityIdentifier,
  toggleKnowledgePageBookmark,
} from '../../utils/KnowledgeCenter';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

// 7 cards needed: tests use indices 0-6
const MIN_CARDS = 7;

test.describe('Knowledge Center List', () => {
  test.slow(true);

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'playwright/.auth/admin.json',
    });

    try {
      for (let i = 0; i < MIN_CARDS; i++) {
        await context.request.post('/api/v1/knowledgeCenter', {
          data: {
            name: `00pw-kc-list-${Date.now()}-${i}`,
            pageType: 'Article',
            page: {
              publicationDate: Date.now(),
              relatedArticles: [],
            },
          },
        });
      }
    } finally {
      await context.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    const listResponse = page.waitForResponse('/api/v1/knowledgeCenter*');
    await sidebarClick(page, SidebarItem.KNOWLEDGE_CENTER);
    await listResponse;
    await page
      .getByTestId('knowledge-page-listing')
      .waitFor({ state: 'visible' });
  });

  test('Knowledge Center List - Verify list visibility and card functionality', async ({
    page,
  }) => {
    await test.step('Verify knowledge page listing is visible', async () => {
      const listing = page.getByTestId('knowledge-page-listing');
      await expect(listing).toBeVisible();
    });

    await test.step('Verify card has content (title, description, metadata)', async () => {
      const card = await getKnowledgePageCardByIndex(page, 0);
      await expect(card).toBeVisible();

      const title = card.getByTestId('entity-header-display-name');
      await expect(title).toBeVisible();
      await expect(title).not.toBeEmpty();

      const titleDescription = card.getByTestId('knowledge-title-description');
      await expect(titleDescription).toBeVisible();

      const knowledgePageLink = card.getByTestId('knowledge-page-link');
      await expect(knowledgePageLink).toBeVisible();

      const dateOwnerCol = card.getByTestId('date-owner-col');
      await expect(dateOwnerCol).toBeVisible();

      const updatedAt = card.getByTestId('updated-at');
      await expect(updatedAt).toBeVisible();
      await expect(updatedAt).not.toBeEmpty();

      const metadata = card.getByTestId('knowledge-metadata');

      await expect(metadata).toBeVisible();
    });
  });

  test('Knowledge Center List - Test upvote and downvote buttons', async ({
    page,
  }) => {
    const card = await getKnowledgePageCardByIndex(page, 1);
    await expect(card).toBeVisible();

    // Get initial up-vote count
    const initialUpVoteCount = Number.parseInt(
      (await card.getByTestId('up-vote-count').textContent()) || '0',
      10
    );

    const upVoteBtn = card.getByTestId('up-vote-btn');
    const upVoteResponse = page.waitForResponse(
      '/api/v1/knowledgeCenter/*/vote'
    );
    await upVoteBtn.click();
    await upVoteResponse;
    await waitForAllLoadersToDisappear(page);

    const expectedUpVoteCount = initialUpVoteCount + 1;
    await expect(card.getByTestId('up-vote-count')).toHaveText(
      String(expectedUpVoteCount)
    );

    // Re-read down count after upvote — if the user had an existing downvote,
    // the upvote action clears it, making a pre-upvote baseline stale.
    const downVoteCountAfterUpvote = Number.parseInt(
      (await card.getByTestId('down-vote-count').textContent()) || '0',
      10
    );

    const downVoteBtn = card.getByTestId('down-vote-btn');
    const downVoteResponse = page.waitForResponse(
      '/api/v1/knowledgeCenter/*/vote'
    );
    await downVoteBtn.click();
    await downVoteResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(card.getByTestId('up-vote-count')).toHaveText(
      String(expectedUpVoteCount - 1)
    );
    await expect(card.getByTestId('down-vote-count')).toHaveText(
      String(downVoteCountAfterUpvote + 1)
    );
  });

  test('Knowledge Center List - Test bookmark functionality', async ({
    page,
  }) => {
    const card = await getKnowledgePageCardByIndex(page, 2);
    await expect(card).toBeVisible();

    const bookmarkIdentifier = await getKnowledgePageCardEntityIdentifier(card);

    const bookmarkBtn = card.getByTestId('bookmark-btn');
    await expect(bookmarkBtn).toBeVisible();

    await toggleKnowledgePageBookmark(
      page,
      bookmarkBtn,
      bookmarkIdentifier,
      true
    );

    const unbookmarkResponse = page.waitForResponse((response) => {
      const url = response.url();
      return (
        url.includes('/api/v1/knowledgeCenter') && url.includes('/followers')
      );
    });

    await bookmarkBtn.click();
    const unbookmarkRes = await unbookmarkResponse;
    expect(unbookmarkRes.status()).toBe(200);
    await waitForAllLoadersToDisappear(page);

    const rightPanel = page.getByTestId('knowledge-center-right-panel');
    const specificBookmark = rightPanel.getByTestId(
      `bookmarked-${bookmarkIdentifier}`
    );
    await expect(specificBookmark).not.toBeVisible();
  });

  test('Knowledge Center List - Verify Recently Viewed widget', async ({
    page,
  }) => {
    const card = await getKnowledgePageCardByIndex(page, 3);
    await expect(card).toBeVisible();

    const cardIdentifier = await getKnowledgePageCardEntityIdentifier(card);
    const cardDisplayText =
      (
        await card.getByTestId('entity-header-display-name').textContent()
      )?.trim() ?? '';

    const knowledgePageLink = card.getByTestId('knowledge-page-link');

    const navigationPromise = page.waitForURL((url) =>
      url.pathname.includes('/knowledge-center/')
    );

    await knowledgePageLink.click();
    await navigationPromise;
    await waitForAllLoadersToDisappear(page);
    await page.waitForSelector('.ant-skeleton-active', {
      state: 'detached',
    });

    const entityHeader = page.getByTestId('entity-header-display-name');
    await expect(entityHeader).toBeVisible();

    await waitForAllLoadersToDisappear(page);

    const listResponse = page.waitForResponse('/api/v1/knowledgeCenter*');
    await sidebarClick(page, SidebarItem.KNOWLEDGE_CENTER);
    await listResponse;
    await page
      .getByTestId('knowledge-page-listing')
      .waitFor({ state: 'visible' });

    await waitForAllLoadersToDisappear(page);

    const rightPanel = page.getByTestId('knowledge-center-right-panel');
    await expect(rightPanel).toBeVisible();

    await expect(rightPanel.getByText('Recently Viewed')).toBeVisible();

    const recentlyViewedItem = rightPanel.getByTestId(
      `recent-viewed-${cardIdentifier}`
    );

    await recentlyViewedItem.scrollIntoViewIfNeeded();
    await expect(recentlyViewedItem).toBeVisible();

    const recentViewNavigationPromise = page.waitForURL((url) =>
      url.pathname.includes('/knowledge-center/')
    );
    await recentlyViewedItem.click();
    await recentViewNavigationPromise;

    await expect(entityHeader).toBeVisible();
    // "Untitled" is the UI placeholder; the actual textarea value is empty string
    const expectedValue = cardDisplayText === 'Untitled' ? '' : cardDisplayText;
    await expect(entityHeader).toHaveValue(expectedValue);
  });

  test('Knowledge Center List - Test infinite scroll/pagination', async ({
    page,
  }) => {
    const listing = page.getByTestId('knowledge-page-listing');
    const cards = listing.locator('.knowledge-card');
    const initialCardCount = await cards.count();

    const observerElement = page.getByTestId('observer-element');
    const paginationResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/knowledgeCenter') &&
        response.url().includes('after=')
    );

    await observerElement.scrollIntoViewIfNeeded();
    await paginationResponse;

    await waitForAllLoadersToDisappear(page);

    const finalCardCount = await cards.count();
    expect(finalCardCount).toBeGreaterThan(initialCardCount);
  });

  test('Knowledge Center List - Test unbookmark functionality', async ({
    page,
  }) => {
    const card = await getKnowledgePageCardByIndex(page, 5);
    await expect(card).toBeVisible();

    const bookmarkIdentifier = await getKnowledgePageCardEntityIdentifier(card);

    const bookmarkBtn = card.getByTestId('bookmark-btn');
    await expect(bookmarkBtn).toBeVisible();

    await toggleKnowledgePageBookmark(
      page,
      bookmarkBtn,
      bookmarkIdentifier,
      true
    );
    await toggleKnowledgePageBookmark(
      page,
      bookmarkBtn,
      bookmarkIdentifier,
      false
    );
  });

  test('Knowledge Center List - Test add article button', async ({ page }) => {
    const addButton = page.getByTestId('add-knowledge-page-btn');
    await expect(addButton).toBeVisible();

    await addButton.click();
    await page.waitForSelector('.ant-dropdown', { state: 'visible' });

    const articleOption = page.getByRole('menuitem', { name: 'Article' });
    await expect(articleOption).toBeVisible();

    const quickLinkOption = page.getByRole('menuitem', { name: 'Quick Link' });
    await expect(quickLinkOption).toBeVisible();

    const createResponse = page.waitForResponse('/api/v1/knowledgeCenter');
    await articleOption.click();
    await createResponse;

    await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
  });

  test('Knowledge Center List - Test metadata section details', async ({
    page,
  }) => {
    const card = await getKnowledgePageCardByIndex(page, 6);
    await expect(card).toBeVisible();

    const metadata = card.getByTestId('knowledge-metadata');
    await expect(metadata).toBeVisible();

    const updatedAtMetadata = metadata.getByTestId('updated-at-metadata');
    await expect(updatedAtMetadata).toBeVisible();
    await expect(updatedAtMetadata).not.toBeEmpty();

    const dateOwnerCol = card.getByTestId('date-owner-col');
    await expect(dateOwnerCol).toBeVisible();

    const ownerLink = dateOwnerCol.getByTestId('owner-link');
    await expect(ownerLink).toBeVisible();
  });
});
