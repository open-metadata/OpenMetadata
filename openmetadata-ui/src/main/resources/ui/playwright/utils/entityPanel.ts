/*
 *  Copyright 2025 Collate.
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
import { expect, Page } from '@playwright/test';
import { redirectToExplorePage } from './common';

export const openEntitySummaryPanel = async (
  page: Page,
  entityName: string
) => {
  const searchResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/v1/search/query')
  );

  await page.getByTestId('searchBox').fill(entityName);

  const searchResponse = await searchResponsePromise;
  expect(searchResponse.status()).toBe(200);

  await page.getByTestId('searchBox').press('Enter');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  await page.waitForLoadState('networkidle');

  const entityCard = page
    .locator('[data-testid="table-data-card"]')
    .filter({ hasText: entityName })
    .first();

  // Only click if the card is visible (search results may be on explore page)
  const isCardVisible = await entityCard.isVisible().catch(() => false);
  if (isCardVisible) {
    await entityCard.click();
    await page.waitForLoadState('networkidle');
  }
};

export const waitForPatchResponse = async (page: Page) => {
  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/v1/') &&
      resp.request().method() === 'PATCH' &&
      !resp.url().includes('/api/v1/analytics')
  );

  const response = await responsePromise;
  expect(response.status()).toBe(200);

  return response;
};

export const navigateToEntityPanelTab = async (page: Page, tabName: string) => {
  const summaryPanel = page.locator('.entity-summary-panel-container');
  const tab = summaryPanel.getByRole('menuitem', {
    name: new RegExp(tabName, 'i'),
  });

  await tab.click();
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const editTags = async (page: Page, tagName: string) => {
  await page.locator('[data-testid="edit-icon-tags"]').click();

  await page
    .locator('[data-testid="selectable-list"]')
    .waitFor({ state: 'visible' });

  await page
    .locator('[data-testid="selectable-list"]')
    .scrollIntoViewIfNeeded();

  const searchTagResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`q=`) &&
      response.url().includes('index=tag_search_index')
  );
  const searchBar = page.locator('[data-testid="tag-select-search-bar"]');
  await searchBar.fill(tagName);

  const searchTagResponse = await searchTagResponsePromise;
  expect(searchTagResponse.status()).toBe(200);

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  const tagOption = page.getByTitle(tagName);
  // Wait for tag option to be visible before clicking
  await tagOption.waitFor({ state: 'visible' });
  await tagOption.click();

  const updateBtn = page.getByRole('button', { name: 'Update' });
  await updateBtn.waitFor({ state: 'visible' });
  await updateBtn.click();
  await waitForPatchResponse(page);

  await expect(page.getByText(/Tags updated successfully/i)).toBeVisible();
};

export const editGlossaryTerms = async (page: Page, termName?: string) => {
  await page
    .locator('[data-testid="edit-glossary-terms"]')
    .scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-testid="edit-glossary-terms"]', {
    state: 'visible',
  });

  await page.locator('[data-testid="edit-glossary-terms"]').click();

  await page
    .locator('[data-testid="selectable-list"]')
    .scrollIntoViewIfNeeded();

  if (termName) {
    const searchBar = page.locator(
      '[data-testid="glossary-term-select-search-bar"]'
    );

    await searchBar.fill(termName);
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    const termOption = page
      .locator('.ant-list-item')
      .filter({ hasText: termName });

    await termOption.click();
  } else {
    const firstTerm = page.locator('.ant-list-item').first();
    await firstTerm.click();
  }

  const patchResp = waitForPatchResponse(page);
  await page.getByRole('button', { name: 'Update' }).click();
  await patchResp;
};

export const editDomain = async (page: Page, domainName: string) => {
  const summaryPanel = page.locator('.entity-summary-panel-container');
  const domainsSection = summaryPanel.locator('.domains-section');

  await domainsSection
    .locator('[data-testid="add-domain"]')
    .scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-testid="add-domain"]', {
    state: 'visible',
  });
  await page.locator('[data-testid="add-domain"]').click();
  const tree = page.getByTestId('domain-selectable-tree');

  await tree.waitFor({ state: 'visible' });

  const searchDomainPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`q=`)
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domainName);

  const searchDomainResponse = await searchDomainPromise;
  expect(searchDomainResponse.status()).toBe(200);

  const tagSelector = page.getByTestId(`tag-${domainName}`);
  await tagSelector.waitFor({ state: 'visible' });

  const patchReqPromise = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await tagSelector.click();

  const patchResponse = await patchReqPromise;
  expect(patchResponse.status()).toBe(200);

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const verifyDeletedEntityNotVisible = async (
  page: Page,
  entityName: string,
  searchBarTestId: string,
  searchIndexType: 'user' | 'team' | 'tag' | 'glossaryTerm'
) => {
  const searchIndexMap = {
    user: 'user_search_index',
    team: 'team_search_index',
    tag: 'tag_search_index',
    glossaryTerm: 'glossary_term_search_index',
  };

  const searchBar = await page.waitForSelector(
    `[data-testid="${searchBarTestId}"]`
  );
  const searchResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`index=${searchIndexMap[searchIndexType]}`)
  );
  await searchBar.fill(entityName);

  const searchResponse = await searchResponsePromise;
  expect(searchResponse.status()).toBe(200);
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  const deletedItem = page.getByTitle(entityName);

  return deletedItem;
};

export const clickDataQualityStatCard = async (
  page: Page,
  statType: 'success' | 'failed' | 'aborted'
) => {
  const statCard = page.locator(
    `[data-testid="data-quality-stat-card-${statType}"]`
  );
  await statCard.click();
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const navigateToIncidentsTab = async (page: Page) => {
  const summaryPanel = page.locator('.entity-summary-panel-container');
  const tabContent = summaryPanel.locator('.data-quality-tab-container');

  const incidentsTabButton = tabContent
    .locator('.ant-tabs-tab')
    .filter({ hasText: /incident/i });

  if (await incidentsTabButton.isVisible()) {
    await incidentsTabButton.click();
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
  }
};

export async function navigateToExploreAndSelectTable(
  page: Page,
  entityName: string
) {
  await redirectToExplorePage(page);

  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  const permissionsResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/permissions')
  );

  await openEntitySummaryPanel(page, entityName);

  const permissionsResponse = await permissionsResponsePromise;
  expect(permissionsResponse.status()).toBe(200);
}
