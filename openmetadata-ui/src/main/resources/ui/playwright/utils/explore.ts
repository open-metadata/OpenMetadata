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
import { expect, Locator } from '@playwright/test';
import { isEmpty, isUndefined } from 'lodash';
import { Page } from 'playwright';
import { EXPECTED_BUCKETS } from '../constant/explore';
import { TableClass } from '../support/entity/TableClass';
import { getApiContext, redirectToExplorePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { openEntitySummaryPanel } from './entityPanel';

export interface Bucket {
  key: string;
  doc_count: number;
}

export const searchAndClickOnOption = async (
  page: Page,
  filter: { key: string; label: string; value?: string },
  checkedAfterClick: boolean
) => {
  let testId = (filter.value ?? '').toLowerCase();
  // Filtering for tiers is done on client side, so no API call will be triggered
  const searchRes = page.waitForResponse(
    `/api/v1/search/aggregate?index=dataAsset&field=${filter.key}**`
  );

  await page.fill('[data-testid="search-input"]', filter.value ?? '');
  await searchRes;

  await page.getByTestId(testId).click();

  await checkCheckboxStatus(page, `${testId}-checkbox`, checkedAfterClick);
};

export const selectNullOption = async (
  page: Page,
  filter: { key: string; label: string; value?: string },
  clearFilter = true
) => {
  const queryFilter = JSON.stringify({
    query: {
      bool: {
        must: [
          {
            bool: {
              should: [
                {
                  bool: {
                    must_not: {
                      exists: { field: `${filter.key}` },
                    },
                  },
                },
                ...(filter.value
                  ? [
                      {
                        term: {
                          [filter.key]: filter.value.toLowerCase(),
                        },
                      },
                    ]
                  : []),
              ],
            },
          },
        ],
      },
    },
  });

  const querySearchURL = `/api/v1/search/query?*index=dataAsset*`;
  await page.click(`[data-testid="search-dropdown-${filter.label}"]`);
  await page.click(`[data-testid="no-option-checkbox"]`);
  if (filter.value) {
    await searchAndClickOnOption(page, filter, true);
  }

  // Immediate-apply commits on selection (no Update button); legacy mode commits
  // on the Update click. Only wait on the Update-triggered response in legacy
  // mode, otherwise the query has already fired and we just let loaders settle.
  const updateButton = page.getByTestId('update-btn');
  if (await updateButton.isVisible().catch(() => false)) {
    const queryRes = page.waitForResponse(querySearchURL);
    await updateButton.click();
    await queryRes;
  }
  await waitForAllLoadersToDisappear(page);

  const queryParams = page.url().split('?')[1];
  const queryParamsObj = new URLSearchParams(queryParams);

  const queryParamValue = queryParamsObj.get('quickFilter');

  expect(queryParamValue).toEqual(queryFilter);

  if (clearFilter) {
    await page.click(`[data-testid="clear-filters"]`);
  }
};

export const checkCheckboxStatus = async (
  page: Page,
  boxId: string,
  isChecked: boolean
) => {
  const checkbox = page.getByTestId(boxId);

  if (isChecked) {
    await expect(checkbox).toBeChecked();
  } else {
    await expect(checkbox).not.toBeChecked();
  }
};

export const selectDataAssetFilter = async (
  page: Page,
  filterValue: string
) => {
  await page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset&from=0&size=0*'
  );
  await page.getByRole('button', { name: 'Data Assets' }).click();
  const dataAssetDropdownRequest = page.waitForResponse(
    '/api/v1/search/aggregate?index=dataAsset&field=entityType.keyword*'
  );
  await page
    .getByTestId('drop-down-menu')
    .getByTestId('search-input')
    .fill(filterValue.toLowerCase());
  await dataAssetDropdownRequest;
  await page.getByTestId(`${filterValue.toLowerCase()}-checkbox`).check();

  // Legacy mode commits + closes on Update; immediate-apply commits on check but
  // leaves the dropdown open, so close it via its trigger to match the helper's
  // post-condition (results interactable for callers).
  const updateButton = page.getByTestId('update-btn');
  if (await updateButton.isVisible().catch(() => false)) {
    await updateButton.click();
  } else {
    await page.getByRole('button', { name: 'Data Assets' }).click();
  }
};

export const validateBucketsForIndex = async (page: Page, index: string) => {
  const { apiContext } = await getApiContext(page);

  const response = await apiContext
    .get(
      `/api/v1/search/query?q=&index=${index}&from=0&size=10&deleted=false&query_filter=%7B%22query%22:%7B%22bool%22:%7B%7D%7D%7D&sort_field=totalVotes&sort_order=desc`
    )
    .then((res) => res.json());

  const buckets = response.aggregations?.['sterms#entityType']?.buckets ?? [];

  EXPECTED_BUCKETS.forEach((expectedKey) => {
    const bucket = buckets.find((b: Bucket) => b.key === expectedKey);

    // Expect the bucket to exist
    expect(bucket, `Bucket with key "${expectedKey}" is missing`).toBeDefined();

    // Expect the bucket's doc_count to be greater than 0
    expect(
      bucket?.doc_count,
      `Bucket "${expectedKey}" has doc_count <= 0`
    ).toBeGreaterThan(0);
  });
};

export const expandServiceInExploreTree = async (
  page: Page,
  serviceName: string,
  serviceExpanded = false
) => {
  if (!serviceExpanded) {
    // Check that the service exists in the explore tree
    const serviceNameRes = page.waitForResponse(
      '/api/v1/search/query?q=&index=database&from=0&size=0*mysql*'
    );
    // Tree rows carry count badges, so match by testid instead of exact text
    await page
      .locator('.ant-tree-treenode')
      .filter({ has: page.getByTestId('explore-tree-title-mysql') })
      .locator('.ant-tree-switcher svg')
      .click();
    await serviceNameRes;
  }

  // Expand the service to see databases
  const databaseRes = page.waitForResponse(
    '/api/v1/search/query?q=&index=dataAsset*serviceType*'
  );
  await page
    .locator('.ant-tree-treenode')
    .filter({ hasText: serviceName })
    .locator('.ant-tree-switcher svg')
    .click();
  await databaseRes;
};

export const expandDatabaseInExploreTree = async (
  page: Page,
  dbName: string
) => {
  // Expand the database to see schemas
  const databaseSchemaRes = page.waitForResponse(
    '/api/v1/search/query?q=&index=dataAsset*database.displayName*'
  );
  await page
    .locator('.ant-tree-treenode')
    .filter({ hasText: dbName })
    .locator('.ant-tree-switcher svg')
    .click();
  await databaseSchemaRes;
};

export const expandSchemaInExploreTree = async (
  page: Page,
  schemaName: string
) => {
  const schemaRes = page.waitForResponse(
    '/api/v1/search/query?q=&index=dataAsset*databaseSchema.displayName*'
  );
  await page
    .locator('.ant-tree-treenode')
    .filter({ hasText: schemaName })
    .locator('.ant-tree-switcher svg')
    .click();
  await schemaRes;
};

export const expandTableInExploreTree = async (
  page: Page,
  tableName: string
) => {
  const columnRes = page.waitForResponse(
    '/api/v1/search/query?*entityType*tableColumn*'
  );
  await page
    .locator('.ant-tree-treenode')
    .filter({ hasText: tableName })
    .locator('.ant-tree-switcher svg')
    .click();
  await columnRes;
};

export const verifyColumnSuggestion = async (
  page: Page,
  columnName: string,
  tableName: string
) => {
  const suggestionsContainer = page.locator('[data-testid="suggestion-box"]');
  const columnSuggestion = suggestionsContainer
    .locator('.suggestion-item')
    .filter({ hasText: columnName })
    .filter({ hasText: tableName })
    .first();

  await expect(columnSuggestion).toBeVisible();

  return columnSuggestion;
};

export const verifyDatabaseAndSchemaInExploreTree = async (
  page: Page,
  serviceName: string,
  dbName: string,
  schemaName: string,
  serviceExpanded = false
) => {
  await expandServiceInExploreTree(page, serviceName, serviceExpanded);

  // Verify the database name is visible
  await expect(page.getByTestId(`explore-tree-title-${dbName}`)).toBeVisible();

  await expandDatabaseInExploreTree(page, dbName);

  // Verify the schema name is visible
  await expect(
    page.getByTestId(`explore-tree-title-${schemaName}`)
  ).toBeVisible();
};

export const validateBucketsForIndexAndSort = async (
  page: Page,
  asset: {
    key: string;
    label: string;
    indexType: string;
  },
  docCount: number
) => {
  const { apiContext } = await getApiContext(page);

  const response = await apiContext
    .get(
      `/api/v1/search/query?q=pw&index=${asset.indexType}&from=0&size=15&deleted=false&sort_field=_score&sort_order=desc`
    )
    .then((res) => res.json());

  const totalCount = response.hits.total.value ?? 0;

  expect(totalCount).toEqual(docCount);
};

export const selectSortOrder = async (page: Page, sortOrder: string) => {
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('sorting-dropdown-label').click();
  await page.getByRole('menuitemradio', { name: sortOrder }).waitFor({
    state: 'visible',
  });
  const nameFilter = page.waitForResponse(
    `/api/v1/search/query?q=&index=dataAsset&*sort_field=displayName.keyword&sort_order=desc*`
  );
  await page.getByRole('menuitemradio', { name: sortOrder }).click();
  await nameFilter;

  await expect(page.getByTestId('sorting-dropdown-label')).toHaveText(
    sortOrder
  );

  const ascSortOrder = page.waitForResponse(
    `/api/v1/search/query?q=&index=dataAsset&*sort_field=displayName.keyword&sort_order=asc*`
  );
  await page.getByTestId('sort-order-button').click();
  await ascSortOrder;
  await waitForAllLoadersToDisappear(page);
};

export const verifyEntitiesAreSorted = async (page: Page) => {
  // Wait for search results to be stable after sort
  await page.getByTestId('search-results').waitFor({
    state: 'visible',
  });

  const entityNames = (
    await page
      .locator(
        '[data-testid="search-results"] .explore-search-card [data-testid="entity-link"]'
      )
      .allTextContents()
  ).map((name) => name.trim());

  // Elasticsearch keyword field with case-insensitive sorting
  const sortedEntityNames = [...entityNames].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    if (aLower < bLower) {
      return -1;
    }
    if (aLower > bLower) {
      return 1;
    }
    return 0;
  });

  expect(entityNames).toEqual(sortedEntityNames);
};

export const navigateToExploreAndSelectEntity = async ({
  page,
  entityName,
  endpoint,
  fullyQualifiedName,
  exploreTab,
  dataAssetTypeLeftPanelTestId,
}: {
  page: Page;
  entityName: string;
  endpoint?: string;
  fullyQualifiedName?: string;
  exploreTab?: string;
  dataAssetTypeLeftPanelTestId?: string;
}) => {
  await redirectToExplorePage(page);

  await expect(page.locator('[data-testid="loader"]')).toHaveCount(0, {
    timeout: 30000,
  });

  await openEntitySummaryPanel({
    page,
    entityName,
    endpoint,
    fullyQualifiedName,
    exploreTab,
    dataAssetTypeLeftPanelTestId,
  });
};

export const getExportModalContent = (page: Page) =>
  page.getByTestId('export-scope-modal').locator('.ant-modal-content');

export const openExportScopeModal = async (page: Page) => {
  await page.getByRole('button', { name: 'Tools' }).click();
  await page.getByRole('menuitemradio', { name: 'Export' }).click();

  await expect(getExportModalContent(page)).toBeVisible();
};

export const countCsvResponseRows = (csvText: string): number =>
  csvText.split('\n').filter((line: string) => line.trim().length > 0).length -
  1;

export const getExportCountFromModal = async (
  modalContent: Locator,
  testId: string
): Promise<number> => {
  const countLocator = modalContent.getByTestId(testId);

  await expect(countLocator).toBeVisible();
  await expect(countLocator).toContainText(/\(\d[\d,]* Results?\)/);

  const text = await countLocator.textContent();
  const match = text?.match(/(\d[\d,]*)/);

  return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
};

export const getFlatColumnCountOfTable = (
  columns: TableClass['entity']['columns']
) => {
  let columnsCount = columns.length;

  columns.forEach((column) => {
    if (!isEmpty(column.children) && !isUndefined(column.children)) {
      columnsCount += getFlatColumnCountOfTable(column.children);
    }
  });

  return columnsCount;
};
