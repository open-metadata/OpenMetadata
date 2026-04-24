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

import { ENDPOINT_TO_FILTER_MAP } from '../constant/explore';
import { EntityClass } from '../support/entity/EntityClass';
import { waitForAllLoadersToDisappear } from './entity';

export const getEntityFqn = (
  entityInstance: EntityClass
): string | undefined => {
  return (
    entityInstance as { entityResponseData?: { fullyQualifiedName?: string } }
  ).entityResponseData?.fullyQualifiedName;
};

const findOptionByScrolling = async (page: Page, endpoint: string) => {
  let tries = 0;
  const maxTries = 5; // Limit the number of scroll attempts to prevent infinite loops
  const filterName = ENDPOINT_TO_FILTER_MAP[endpoint];
  const dropdown = page
    .getByTestId('global-search-select-dropdown')
    .locator('.rc-virtual-list-holder');
  const option = page.getByTestId(`global-search-select-option-${filterName}`);
  while (tries < maxTries) {
    if (await option.isVisible()) {
      await option.click();
      return;
    }
    // Scroll the dropdown to load more options
    await dropdown.evaluate((element) => {
      element.scrollBy(0, 100); // Adjust scroll amount as needed
    });
    tries++;
  }
  await dropdown.evaluate((element) => {
    element.scrollTop = 0;
  });
  throw new Error(
    `Unable to find global search filter option "${filterName}" for endpoint "${endpoint}" after ${maxTries} scroll attempts.`
  );
};

export const openEntitySummaryPanel = async ({
  page,
  entityName,
  endpoint,
  fullyQualifiedName,
  exploreTab,
}: {
  page: Page;
  entityName: string;
  endpoint?: string;
  fullyQualifiedName?: string;
  exploreTab?: string;
}) => {
  if (endpoint && ENDPOINT_TO_FILTER_MAP[endpoint]) {
    await page.getByTestId('global-search-selector').waitFor({
      state: 'visible',
    });
    await page.getByTestId('global-search-selector').click();
    await page.getByTestId('global-search-select-dropdown').waitFor({
      state: 'visible',
    });
    await findOptionByScrolling(page, endpoint);
  }
  const searchResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/v1/search/query')
  );

  await page.getByTestId('searchBox').fill(entityName);

  const searchResponse = await searchResponsePromise;
  expect(searchResponse.status()).toBe(200);

  await page.getByTestId('searchBox').press('Enter');
  await waitForAllLoadersToDisappear(page);

  if (exploreTab) {
    const tab = page
      .getByTestId('explore-left-panel')
      .getByRole('menuitem', { name: exploreTab });
    await tab.waitFor({ state: 'visible' });
    await tab.click();
    await waitForAllLoadersToDisappear(page);
  }

  if (fullyQualifiedName) {
    const cardByFqn = page.getByTestId(`table-data-card_${fullyQualifiedName}`);
    await cardByFqn.waitFor({ state: 'visible' });

    // Since the directly clicking on the card can sometimes click on title element which is link,
    // we need to click on description container to open the summary panel.
    await cardByFqn.getByTestId('description-text').click();

    return;
  }

  await page
    .locator('[data-testid^="table-data-card"]')
    .filter({
      has: page.getByTestId('entity-link').filter({ hasText: entityName }),
    })
    .getByTestId('description-text')
    .click();
};
// ... (lines 48-468 unchanged)
export async function navigateToExploreAndSelectTable(
  page: Page,
  entityName: string,
  endpoint?: string,
  exploreTab?: string,
  fullyQualifiedName?: string
) {
  await redirectToExplorePage(page);

  await waitForAllLoadersToDisappear(page);

  const permissionsResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/permissions')
  );

  await openEntitySummaryPanel({
    page,
    entityName,
    endpoint,
    exploreTab,
    fullyQualifiedName,
  });

  const permissionsResponse = await permissionsResponsePromise;
  expect(permissionsResponse.status()).toBe(200);

  // Ensure all the component for right panel are rendered
  const loaders = page.locator(
    '[data-testid="entity-summary-panel-container"] [data-testid="loader"]'
  );

  // Wait for the loader elements count to become 0
  await expect(loaders).toHaveCount(0, { timeout: 30000 });
}

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
  await waitForAllLoadersToDisappear(page);
};

export const editTags = async (page: Page, tagName: string) => {
  const editIcon = page.locator('[data-testid="edit-icon-tags"]');
  if (await editIcon.isVisible()) {
    await editIcon.click();
  } else {
    // Fallback for ML Model which uses an 'Add' chip
    await page
      .locator('[data-testid="entity-tags"] [data-testid="add-tag"]')
      .click();
  }

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
      response.url().includes('index=tag')
  );
  const searchBar = page.locator('[data-testid="tag-select-search-bar"]');
  await searchBar.fill(tagName);

  const searchTagResponse = await searchTagResponsePromise;
  expect(searchTagResponse.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);

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
  await page
    .locator(
      '[data-testid="edit-glossary-terms"], [data-testid="glossary-container"] [data-testid="add-tag"]'
    )
    .first()
    .waitFor({
      state: 'visible',
    });

  const editIcon = page.locator('[data-testid="edit-glossary-terms"]');
  if (await editIcon.isVisible()) {
    await editIcon.click();
  } else {
    // Fallback for ML Model which uses an 'Add' chip
    await page
      .locator('[data-testid="glossary-container"] [data-testid="add-tag"]')
      .click();
  }

  await page
    .locator('[data-testid="selectable-list"]')
    .waitFor({ state: 'visible' });

  if (termName) {
    const searchBar = page.locator(
      '[data-testid="glossary-term-select-search-bar"]'
    );

    await searchBar.fill(termName);
    await waitForAllLoadersToDisappear(page);
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
  await page.getByTestId('add-domain').waitFor({
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

  const tagSelector = page
    .getByTestId('domain-selectable-tree')
    .getByText(domainName);
  await tagSelector.waitFor({ state: 'visible' });

  const patchReqPromise = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await tagSelector.click();

  const patchResponse = await patchReqPromise;
  expect(patchResponse.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);
};

export const verifyDeletedEntityNotVisible = async (
  page: Page,
  entityName: string,
  searchBarTestId: string,
  searchIndexType: 'user' | 'team' | 'tag' | 'glossaryTerm'
) => {
  const searchIndexMap = {
    user: 'user',
    team: 'team',
    tag: 'tag',
    glossaryTerm: 'glossaryTerm',
  };

  const searchBar = page.getByTestId(searchBarTestId);
  await searchBar.waitFor();
  const searchResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`index=${searchIndexMap[searchIndexType]}`)
  );
  await searchBar.fill(entityName);

  const searchResponse = await searchResponsePromise;
  expect(searchResponse.status()).toBe(200);
  await waitForAllLoadersToDisappear(page);

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
  await waitForAllLoadersToDisappear(page);
};

export const navigateToIncidentsTab = async (page: Page) => {
  const summaryPanel = page.locator('.entity-summary-panel-container');
  const tabContent = summaryPanel.locator('.data-quality-tab-container');

  const incidentsTabButton = tabContent
    .locator('.ant-tabs-tab')
    .filter({ hasText: /incident/i });

  if (await incidentsTabButton.isVisible()) {
    await incidentsTabButton.click();
    await waitForAllLoadersToDisappear(page);
  }
};

export const removeTagsFromPanel = async (
  page: Page,
  tagDisplayNames: string[]
) => {
  await page.getByTestId('edit-icon-tags').click();

  await page
    .locator('[data-testid="selectable-list"]')
    .waitFor({ state: 'visible' });

  await waitForAllLoadersToDisappear(page);

  for (const tagName of tagDisplayNames) {
    const tagOption = page.getByTitle(tagName);
    await tagOption.waitFor({ state: 'visible' });
    await tagOption.click();
  }

  const patchPromise = waitForPatchResponse(page);
  await page.getByRole('button', { name: 'Update' }).click();
  await patchPromise;
};

export const removeGlossaryTermFromPanel = async (
  page: Page,
  termDisplayNames: string[]
) => {
  await page
    .locator('[data-testid="edit-glossary-terms"]')
    .scrollIntoViewIfNeeded();

  await page.getByTestId('edit-glossary-terms').waitFor({
    state: 'visible',
  });
  // eslint-disable-next-line playwright/no-force-option -- popover trigger may be partially obstructed by animation
  await page.getByTestId('edit-glossary-terms').click({ force: true });

  await page
    .locator('[data-testid="selectable-list"]')
    .waitFor({ state: 'visible' });

  await waitForAllLoadersToDisappear(page);
  for (const termName of termDisplayNames) {
    const searchBar = page.getByTestId('glossary-term-select-search-bar');
    await searchBar.fill(termName);

    // Wait for the list to update with search results
    const termItem = page
      .locator('.ant-list-item')
      .filter({ hasText: termName });
    await termItem.waitFor({ state: 'visible' });

    await termItem.click();

    // Clear search for next iteration if there are multiple terms
    await searchBar.clear();
  }

  const patchPromise = waitForPatchResponse(page);
  await page.getByRole('button', { name: 'Update' }).click();
  await patchPromise;
};

export const removeOwnerFromPanel = async (
  page: Page,
  ownerNames: string[],
  type: 'Users' | 'Teams' = 'Users'
) => {
  await page.getByTestId('edit-owners').waitFor({
    state: 'visible',
  });
  // eslint-disable-next-line playwright/no-force-option -- popover trigger may be partially obstructed by animation
  await page.getByTestId('edit-owners').click({ force: true });

  await page.getByTestId('select-owner-tabs').waitFor({ state: 'visible' });

  await page.getByRole('tab', { name: type }).click();

  const patchPromise = waitForPatchResponse(page);

  for (const ownerName of ownerNames) {
    const searchBarDataTestId =
      type === 'Users'
        ? 'owner-select-users-search-bar'
        : 'owner-select-teams-search-bar';
    const searchBar = page.getByTestId(searchBarDataTestId);
    if (await searchBar.isVisible()) {
      await searchBar.fill(ownerName);
      const ownerItem = page
        .locator('.ant-list-item')
        .filter({ hasText: ownerName });
      await ownerItem.waitFor({ state: 'visible' });
      await ownerItem.click();
    } else {
      const ownerItem = page
        .locator('.ant-list-item')
        .filter({ hasText: ownerName });
      await ownerItem.waitFor({ state: 'visible' });
      await ownerItem.click();
    }
  }

  const updateButton = page.getByTestId('selectable-list-update-btn');
  if (await updateButton.isVisible()) {
    await updateButton.click();
  }

  await patchPromise;
};

export const removeDomainFromPanel = async (page: Page, domainName: string) => {
  await page.getByTestId('add-domain').waitFor({
    state: 'visible',
  });

  // eslint-disable-next-line playwright/no-force-option -- popover trigger may be partially obstructed by animation
  await page.getByTestId('add-domain').click({ force: true });

  const domainTree = page.getByTestId('domain-selectable-tree');
  await domainTree.waitFor({ state: 'visible' });

  const searchDomainPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`q=`)
  );

  await domainTree.getByTestId('searchbar').fill(domainName);

  await searchDomainPromise;

  const domainItem = domainTree.getByText(domainName);
  const patchPromise = waitForPatchResponse(page);

  await domainItem.click();

  const updateButton = page.getByRole('button', { name: 'Update' });
  if (await updateButton.isVisible()) {
    await updateButton.click();
  }

  await patchPromise;
};

export const assignTierToPanel = async (page: Page, tierName: string) => {
  await page.getByTestId('edit-icon-tier').waitFor({
    state: 'visible',
  });
  // eslint-disable-next-line playwright/no-force-option -- popover trigger may be partially obstructed by animation
  await page.getByTestId('edit-icon-tier').click({ force: true });

  const tierPopover = page.getByTestId('cards');
  await tierPopover.waitFor({ state: 'visible' });

  await waitForAllLoadersToDisappear(page);

  const tierRadioButton = page.getByTestId(`radio-btn-${tierName}`);
  await tierRadioButton.waitFor({ state: 'visible' });

  const patchPromise = waitForPatchResponse(page);

  await tierRadioButton.click();

  const updateButton = page.getByTestId('update-tier-card');
  await updateButton.waitFor({ state: 'visible' });
  await updateButton.click();

  await patchPromise;

  await waitForAllLoadersToDisappear(page);
};

export const removeTierFromPanel = async (page: Page) => {
  await page.locator('[data-testid="edit-icon-tier"]').scrollIntoViewIfNeeded();
  await page.getByTestId('edit-icon-tier').waitFor({
    state: 'visible',
  });
  // eslint-disable-next-line playwright/no-force-option -- popover trigger may be partially obstructed by animation
  await page.getByTestId('edit-icon-tier').click({ force: true });

  const tierPopover = page.getByTestId('cards');
  await tierPopover.waitFor({ state: 'visible' });

  const clearButton = tierPopover.getByTestId('clear-tier');
  await clearButton.waitFor({ state: 'visible' });

  const patchPromise = waitForPatchResponse(page);
  await clearButton.click();
  await patchPromise;
};

/**
 * Maps entity types to their corresponding left panel asset type titles
 */
function getAssetTypeFromEntityType(entityType: string): string {
  const entityTypeToAssetType: Record<string, string> = {
    Table: 'Databases',
    Database: 'Databases',
    'Database Schema': 'Databases',
    'Store Procedure': 'Databases',
    Dashboard: 'Dashboards',
    DashboardDataModel: 'Dashboards',
    Chart: 'Dashboards',
    Pipeline: 'Pipelines',
    Topic: 'Topics',
    MlModel: 'ML Models',
    Container: 'Containers',
    SearchIndex: 'Search Indexes',
    ApiEndpoint: 'APIs',
    'Api Collection': 'APIs',
    File: 'Drives',
    Directory: 'Drives',
    Spreadsheet: 'Drives',
    Worksheet: 'Drives',
    Metric: 'Metrics',
  };

  return entityTypeToAssetType[entityType] || 'Databases';
}

export const editDisplayNameFromPanel = async (
  page: Page,
  newDisplayName: string
) => {
  const summaryPanel = page.locator('.entity-summary-panel-container');
  const editButton = summaryPanel.getByTestId('edit-displayName-button');

  await editButton.waitFor({ state: 'visible' });
  await editButton.click();

  const modal = page.locator('.ant-modal');
  await modal.waitFor({ state: 'visible' });

  const displayNameInput = modal.locator('#displayName');
  await displayNameInput.waitFor({ state: 'visible' });
  await displayNameInput.clear();
  await displayNameInput.fill(newDisplayName);

  const patchPromise = waitForPatchResponse(page);
  await modal.getByTestId('save-button').click();
  await patchPromise;

  await modal.waitFor({ state: 'hidden' });
};
