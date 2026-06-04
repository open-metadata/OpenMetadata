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
import { KnowledgeCenterClass } from '../../support/entity/KnowledgeCenterClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  getKnowledgePageCardByIndex,
  getKnowledgePageCardEntityIdentifier,
} from '../../utils/KnowledgeCenter';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

// 7 cards needed: tests use indices 0-6
const MIN_CARDS = 7;
let knowledgeCenter: KnowledgeCenterClass;

test.describe('Knowledge Center List', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    knowledgeCenter = new KnowledgeCenterClass();
    await knowledgeCenter.create(apiContext, MIN_CARDS);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await knowledgeCenter.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    const listResponse = page.waitForResponse('/api/v1/contextCenter/pages*');
    await sidebarClick(page, SidebarItem.ARTICLE);
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

      const title = card.getByTestId('knowledge-card-title');
      await expect(title).toBeVisible();
      await expect(title).not.toBeEmpty();

      const titleDescription = card.getByTestId('knowledge-card-description');
      await expect(titleDescription).toBeVisible();

      const knowledgePageLink = card.getByTestId('knowledge-page-link');
      await expect(knowledgePageLink).toBeVisible();

      const updatedAt = card.getByTestId('updated-at');
      await expect(updatedAt).toBeVisible();
      await expect(updatedAt).not.toBeEmpty();
    });
  });

  test('Knowledge Center List - Verify Recently Viewed widget', async ({
    page,
  }) => {
    const card = await getKnowledgePageCardByIndex(page, 3);
    await expect(card).toBeVisible();

    const cardIdentifier = await getKnowledgePageCardEntityIdentifier(card);
    const cardDisplayText =
      (await card.getByTestId('knowledge-card-title').textContent())?.trim() ??
      '';

    const knowledgePageLink = card.getByTestId('knowledge-page-link');

    const navigationPromise = page.waitForURL((url) =>
      url.pathname.includes('/context-center/articles/')
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

    const listResponse = page.waitForResponse('/api/v1/contextCenter/pages*');
    await sidebarClick(page, SidebarItem.ARTICLE);
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
      url.pathname.includes('/context-center/articles/')
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
    const cards = listing.locator('[data-testid^="knowledge-card-"]');
    const initialCardCount = await cards.count();

    const observerElement = page.getByTestId('observer-element');
    const paginationResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/contextCenter/pages') &&
        response.url().includes('offset=')
    );

    await observerElement.scrollIntoViewIfNeeded();
    await paginationResponse;

    await waitForAllLoadersToDisappear(page);

    const finalCardCount = await cards.count();
    expect(finalCardCount).toBeGreaterThan(initialCardCount);
  });
});
