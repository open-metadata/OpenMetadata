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
import { Page } from '@playwright/test';

export const openEntitySummaryPanel = async (
  page: Page,
  entityName: string
) => {
  const searchResponse = page.waitForResponse('/api/v1/search/query*');

  await page.getByTestId('searchBox').fill(entityName);
  await searchResponse;

  await page.getByTestId('searchBox').press('Enter');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  await page.waitForLoadState('networkidle');

  const entityCard = page
    .locator('[data-testid="table-data-card"]')
    .filter({ hasText: entityName })
    .first();
  if (await entityCard.isVisible()) {
    await entityCard.click();
    await page.waitForLoadState('networkidle');
  }
};

export const waitForPatchResponse = async (page: Page) => {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/v1/') &&
      resp.request().method() === 'PATCH' &&
      !resp.url().includes('/api/v1/analytics')
  );
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

export const editTags = async (
  page: Page,
  tagName: string,
  clearExisting = false
) => {
  await page.locator('[data-testid="edit-icon-tags"]').scrollIntoViewIfNeeded();

  await page.locator('[data-testid="edit-icon-tags"]').click();

  if (clearExisting) {
    const clearAllButton = page.locator('[data-testid="clear-all-button"]');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    if (await clearAllButton.isVisible()) {
      await clearAllButton.click();
      const updateButton = page.getByRole('button', {
        name: 'Update',
      });
      await updateButton.click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page
        .locator('[data-testid="edit-icon-tags"]')
        .scrollIntoViewIfNeeded();
      await page.locator('[data-testid="edit-icon-tags"]').click();
    }
  }

  await page
    .locator('[data-testid="selectable-list"]')
    .waitFor({ state: 'visible' });

  await page
    .locator('[data-testid="selectable-list"]')
    .scrollIntoViewIfNeeded();

  const searchTagResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(
      tagName
    )}*index=tag_search_index*`
  );
  const searchBar = page.locator('[data-testid="tag-select-search-bar"]');
  await searchBar.fill(tagName);
  await searchTagResponse;
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  const tagOption = page.getByTitle(tagName);
  if (await tagOption.isVisible()) {
    await tagOption.click();

    const updateBtn = page.getByRole('button', { name: 'Update' });
    if (await updateBtn.isVisible()) {
      await updateBtn.click();
      await waitForPatchResponse(page);
    }
  }
};

export const editGlossaryTerms = async (
  page: Page,
  termName?: string,
  clearExisting = false
) => {
  await page
    .locator('[data-testid="edit-glossary-terms"]')
    .scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-testid="edit-glossary-terms"]', {
    state: 'visible',
  });

  await page.locator('[data-testid="edit-glossary-terms"]').click();

  if (clearExisting) {
    const glossaryTermItems = page.locator('.selected-glossary-term-chip');
    const glossaryTermsCount = await glossaryTermItems.count();

    if (glossaryTermsCount >= 1) {
      const clearAllButton = page.locator('[data-testid="clear-all-button"]');
      if (await clearAllButton.isVisible()) {
        await clearAllButton.click();
        const updateButton = page.getByRole('button', {
          name: 'Update',
        });
        await updateButton.click();
        await waitForPatchResponse(page);
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await page
          .locator('[data-testid="edit-glossary-terms"]')
          .scrollIntoViewIfNeeded();
        await page.waitForSelector('[data-testid="edit-glossary-terms"]', {
          state: 'visible',
        });
        await page.locator('[data-testid="edit-glossary-terms"]').click();
      }
    } else {
      await page.waitForTimeout(100);
    }
  }

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

export const clearAndAddGlossaryTerms = async (
  page: Page,
  termName?: string
) => {
  const glossaryTermItems = page.locator('.selected-glossary-term-chip');
  const glossaryTermsCount = await glossaryTermItems.count();

  if (glossaryTermsCount >= 1) {
    const editGlossaryTermsButton = page.locator(
      '[data-testid="edit-glossary-terms"]'
    );
    await editGlossaryTermsButton.click();
    const clearAllButton = page.locator('[data-testid="clear-all-button"]');
    await clearAllButton.click();

    const updateButton = page.getByRole('button', {
      name: 'Update',
    });
    await updateButton.click();
    await waitForPatchResponse(page);
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
  }

  await editGlossaryTerms(page, termName);
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

  const searchDomain = page.waitForResponse(
    `/api/v1/search/query?q=*${domainName}*`
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domainName);

  await searchDomain;

  const tagSelector = page.getByTestId(`tag-${domainName}`);
  await tagSelector.waitFor({ state: 'visible' });

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await tagSelector.click();

  await patchReq;
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const clearDataProducts = async (page: Page) => {
  const dataProductItems = page.locator('[data-testid="data-product-item"]');
  const dataProductCount = await dataProductItems.count();

  if (dataProductCount >= 1) {
    const editDataProductsButton = page.locator(
      '[data-testid="edit-data-products"]'
    );
    if (await editDataProductsButton.isVisible()) {
      await editDataProductsButton.click();
      await page.waitForTimeout(500);

      const clearAllButton = page.locator('[data-testid="clear-all-button"]');
      if (await clearAllButton.isVisible()) {
        await clearAllButton.click();

        const updateButton = page.getByRole('button', {
          name: 'Update',
        });
        await updateButton.click();
        await waitForPatchResponse(page);
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
      }
    }
  }
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
  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`index=${searchIndexMap[searchIndexType]}`)
  );
  await searchBar.fill(entityName);
  await searchResponse;
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
