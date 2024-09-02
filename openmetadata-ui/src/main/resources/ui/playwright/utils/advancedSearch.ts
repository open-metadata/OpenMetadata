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
import { expect, Page } from '@playwright/test';
import { SidebarItem } from '../constant/sidebar';
import { sidebarClick } from './sidebar';

type EntityFields = {
  id: string;
  name: string;
  localSearch: boolean;
};

export const FIELDS: EntityFields[] = [
  {
    id: 'Owner',
    name: 'owners.displayName.keyword',
    localSearch: false,
  },
  {
    id: 'Tags',
    name: 'tags.tagFQN',
    localSearch: false,
  },
  {
    id: 'Tier',
    name: 'tier.tagFQN',
    localSearch: true,
  },
  {
    id: 'Service',
    name: 'service.displayName.keyword',
    localSearch: false,
  },
  {
    id: 'Database',
    name: 'database.displayName.keyword',
    localSearch: false,
  },
  {
    id: 'Database Schema',
    name: 'databaseSchema.displayName.keyword',
    localSearch: false,
  },
  {
    id: 'Column',
    name: 'columns.name.keyword',
    localSearch: false,
  },
];

export const OPERATOR = {
  AND: {
    name: 'AND',
    index: 1,
  },
  OR: {
    name: 'OR',
    index: 2,
  },
};

export const CONDITIONS_MUST = {
  equalTo: {
    name: '==',
    filter: 'must',
  },
  contains: {
    name: 'Contains',
    filter: 'must',
  },
  anyIn: {
    name: 'Any in',
    filter: 'must',
  },
};

export const CONDITIONS_MUST_NOT = {
  notEqualTo: {
    name: '!=',
    filter: 'must_not',
  },
  notIn: {
    name: 'Not in',
    filter: 'must_not',
  },
  notContains: {
    name: 'Not contains',
    filter: 'must_not',
  },
};

export const NULL_CONDITIONS = {
  isNull: {
    name: 'Is null',
    filter: 'empty',
  },
  isNotNull: {
    name: 'Is not null',
    filter: 'empty',
  },
};

export const goToAdvanceSearch = async (page: Page) => {
  await sidebarClick(page, SidebarItem.SETTINGS);
  await page.click('[data-testid="advance-search-button"]');
  await page.click('[data-testid="reset-btn"]');
};

export const fillRule = async (
  page: Page,
  { condition, field, searchCriteria, index }
) => {
  await page.locator('.rule .rule--field .ant-select').nth(index).click();
  await page
    .locator(`.ant-select-dropdown:visible [title="${field.id}"]`)
    .click();

  await page.locator('.rule .rule--operator .ant-select').nth(index).click();
  await page.locator(`.ant-select-dropdown [title="${condition}"]`).click();

  if (searchCriteria) {
    const inputElement = page.locator('.rule--widget--TEXT input[type="text"]');
    const isVisible = await inputElement.isVisible();

    const searchData = field.localSearch
      ? searchCriteria
      : searchCriteria.toLowerCase();
    if (isVisible) {
      await inputElement.fill(searchData);
    } else if (field.localSearch) {
      await page
        .locator('.widget--widget > .ant-select > .ant-select-selector input')
        .click();

      await page
        .locator('.widget--widget > .ant-select > .ant-select-selector input')
        .fill(searchData);
      await page
        .locator(`.ant-select-dropdown [title="${searchData}"]`)
        .click();
    } else {
      const aggregateRes = page.waitForResponse('/api/v1/search/aggregate?*');
      await page
        .locator('.widget--widget > .ant-select > .ant-select-selector input')
        .click();

      await page
        .locator('.widget--widget > .ant-select > .ant-select-selector input')
        .fill(searchData);
      await aggregateRes;
      await page
        .locator(`.ant-select-dropdown [title="${searchData}"]`)
        .click();
    }
  }
};

export const checkMustPaths = async (
  page: Page,
  { condition, field, searchCriteria, index }
) => {
  const searchData = field.localSearch
    ? searchCriteria
    : searchCriteria.toLowerCase();

  await fillRule(page, {
    condition,
    field,
    searchCriteria,
    index,
  });

  const searchRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await page.getByTestId('apply-btn').click();
  await searchRes.then(async (res) => {
    await expect(res.request().url()).toContain(encodeURI(searchData));

    await res.json().then(async (json) => {
      await expect(JSON.stringify(json.hits.hits)).toContain(searchCriteria);
    });
  });

  await expect(
    page.getByTestId('advance-search-filter-container')
  ).toContainText(searchData);
};

export const checkMustNotPaths = async (
  page: Page,
  { condition, field, searchCriteria, index }
) => {
  const searchData = field.localSearch
    ? searchCriteria
    : searchCriteria.toLowerCase();

  await fillRule(page, {
    condition,
    field,
    searchCriteria,
    index,
  });

  const searchRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await page.getByTestId('apply-btn').click();
  await searchRes.then(async (res) => {
    await expect(res.request().url()).toContain(encodeURI(searchData));

    if (!['columns.name.keyword'].includes(field.name)) {
      await res.json().then(async (json) => {
        await expect(JSON.stringify(json.hits.hits)).not.toContain(
          searchCriteria
        );
      });
    }
  });

  await expect(
    page.getByTestId('advance-search-filter-container')
  ).toContainText(searchData);
};

export const checkNullPaths = async (
  page: Page,
  { condition, field, searchCriteria, index }
) => {
  await fillRule(page, {
    condition,
    field,
    searchCriteria,
    index,
  });

  const searchRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await page.getByTestId('apply-btn').click();
  await searchRes.then(async (res) => {
    const urlParams = new URLSearchParams(res.request().url());
    const queryFilter = JSON.parse(urlParams.get('query_filter') ?? '');

    const resultQuery =
      condition === 'Is null'
        ? {
            query: {
              bool: {
                must: [
                  {
                    bool: {
                      must: [
                        {
                          bool: {
                            must_not: {
                              exists: { field: field.name },
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          }
        : {
            query: {
              bool: {
                must: [
                  {
                    bool: {
                      must: [{ exists: { field: field.name } }],
                    },
                  },
                ],
              },
            },
          };

    await expect(JSON.stringify(queryFilter)).toContain(
      JSON.stringify(resultQuery)
    );
  });
};

export const verifyAllConditions = async (
  page: Page,
  field: EntityFields,
  searchCriteria: string
) => {
  // Check for Must conditions
  for (const condition of Object.values(CONDITIONS_MUST)) {
    await page.getByTestId('advance-search-button').click();
    await checkMustPaths(page, {
      condition: condition.name,
      field,
      searchCriteria: searchCriteria,
      index: 0,
    });
    await page.getByTestId('clear-filters').click();
  }

  // Check for Must Not conditions
  for (const condition of Object.values(CONDITIONS_MUST_NOT)) {
    await page.getByTestId('advance-search-button').click();
    await checkMustNotPaths(page, {
      condition: condition.name,
      field,
      searchCriteria: searchCriteria,
      index: 0,
    });
    await page.getByTestId('clear-filters').click();
  }

  // Check for Null and Not Null conditions
  for (const condition of Object.values(NULL_CONDITIONS)) {
    await page.getByTestId('advance-search-button').click();
    await checkNullPaths(page, {
      condition: condition.name,
      field,
      searchCriteria: undefined,
      index: 0,
    });
    await page.getByTestId('clear-filters').click();
  }
};
