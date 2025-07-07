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
import { expect, Locator, Page } from '@playwright/test';
import { clickOutside } from './common';
import { getEncodedFqn } from './entity';

type EntityFields = {
  id: string;
  name: string;
  localSearch: boolean;
  skipConditions?: string[];
};

export const FIELDS: EntityFields[] = [
  {
    id: 'Owners',
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
  {
    id: 'Display Name',
    name: 'displayName.keyword',
    localSearch: false,
    skipConditions: ['isNull', 'isNotNull'], // Null and isNotNull conditions are not present for display name
  },
  {
    id: 'Service Type',
    name: 'serviceType',
    localSearch: false,
  },
  {
    id: 'Schema Field',
    name: 'messageSchema.schemaFields.name.keyword',
    localSearch: false,
  },
  {
    id: 'Container Column',
    name: 'dataModel.columns.name.keyword',
    localSearch: false,
  },
  {
    id: 'Data Model Type',
    name: 'dataModelType',
    localSearch: false,
  },
  {
    id: 'Field',
    name: 'fields.name.keyword',
    localSearch: false,
  },
  {
    id: 'Task',
    name: 'tasks.displayName.keyword',
    localSearch: false,
  },
  {
    id: 'Domain',
    name: 'domain.displayName.keyword',
    localSearch: false,
  },
  {
    id: 'Name',
    name: 'name.keyword',
    localSearch: false,
    skipConditions: ['isNull', 'isNotNull'], // Null and isNotNull conditions are not present for name
  },
  {
    id: 'Project',
    name: 'project.keyword',
    localSearch: false,
  },
  {
    id: 'Status',
    name: 'status',
    localSearch: false,
  },
  {
    id: 'Table Type',
    name: 'tableType',
    localSearch: false,
  },
  {
    id: 'Chart',
    name: 'charts.displayName.keyword',
    localSearch: false,
  },
  {
    id: 'Response Schema Field',
    name: 'responseSchema.schemaFields.name.keyword',
    localSearch: false,
  },
  {
    id: 'Request Schema Field',
    name: 'requestSchema.schemaFields.name.keyword',
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

export const showAdvancedSearchDialog = async (page: Page) => {
  await page.getByTestId('advance-search-button').click();

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();
};

export const selectOption = async (
  page: Page,
  dropdownLocator: Locator,
  optionTitle: string
) => {
  await dropdownLocator.click();
  await page.keyboard.type(optionTitle);
  await page.waitForSelector(`.ant-select-dropdown:visible`, {
    state: 'visible',
  });
  await page.click(`.ant-select-dropdown:visible [title="${optionTitle}"]`);
};

export const fillRule = async (
  page: Page,
  {
    condition,
    field,
    searchCriteria,
    index,
  }: {
    condition: string;
    field: EntityFields;
    searchCriteria?: string;
    index: number;
  }
) => {
  const ruleLocator = page.locator('.rule').nth(index - 1);

  // Perform click on rule field
  await selectOption(
    page,
    ruleLocator.locator('.rule--field .ant-select'),
    field.id
  );

  // Perform click on operator
  await selectOption(
    page,
    ruleLocator.locator('.rule--operator .ant-select'),
    condition
  );

  if (searchCriteria) {
    const inputElement = ruleLocator.locator(
      '.rule--widget--TEXT input[type="text"]'
    );
    const searchData = field.localSearch
      ? searchCriteria
      : searchCriteria.toLowerCase();

    if (await inputElement.isVisible()) {
      await inputElement.fill(searchData);
    } else {
      const dropdownInput = ruleLocator.locator(
        '.widget--widget > .ant-select > .ant-select-selector input'
      );
      let aggregateRes;

      if (!field.localSearch) {
        aggregateRes = page.waitForResponse('/api/v1/search/aggregate?*');
      }

      await dropdownInput.click();
      if (aggregateRes) {
        await aggregateRes;
      }
      await dropdownInput.fill(searchData);

      if (aggregateRes) {
        await aggregateRes;
      }

      await page
        .locator(`.ant-select-dropdown:visible [title="${searchData}"]`)
        .click();
    }

    await clickOutside(page);
  }
};

export const checkMustPaths = async (
  page: Page,
  {
    condition,
    field,
    searchCriteria,
    index,
  }: {
    condition: string;
    field: EntityFields;
    searchCriteria: string;
    index: number;
  }
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
    '/api/v1/search/query?*index=dataAsset&from=0&size=10*'
  );
  await page.getByTestId('apply-btn').click();

  const res = await searchRes;

  expect(res.request().url()).toContain(getEncodedFqn(searchData, true));

  const json = await res.json();

  expect(JSON.stringify(json.hits.hits)).toContain(searchCriteria);

  await expect(
    page.getByTestId('advance-search-filter-container')
  ).toContainText(searchData);
};

export const checkMustNotPaths = async (
  page: Page,
  {
    condition,
    field,
    searchCriteria,
    index,
  }: {
    condition: string;
    field: EntityFields;
    searchCriteria: string;
    index: number;
  }
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
    '/api/v1/search/query?*index=dataAsset&from=0&size=10*'
  );
  await page.getByTestId('apply-btn').click();
  const res = await searchRes;

  expect(res.request().url()).toContain(getEncodedFqn(searchData, true));

  if (!['columns.name.keyword'].includes(field.name)) {
    const json = await res.json();

    expect(JSON.stringify(json.hits.hits)).not.toContain(searchCriteria);
  }

  await expect(
    page.getByTestId('advance-search-filter-container')
  ).toContainText(searchData);
};

export const checkNullPaths = async (
  page: Page,
  {
    condition,
    field,
    searchCriteria,
    index,
  }: {
    condition: string;
    field: EntityFields;
    searchCriteria?: string;
    index: number;
  }
) => {
  await fillRule(page, {
    condition,
    field,
    searchCriteria,
    index,
  });

  const searchRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset&from=0&size=10*'
  );
  await page.getByTestId('apply-btn').click();
  const res = await searchRes;
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

  expect(JSON.stringify(queryFilter)).toContain(JSON.stringify(resultQuery));
};

export const verifyAllConditions = async (
  page: Page,
  field: EntityFields,
  searchCriteria: string
) => {
  // Check for Must conditions
  for (const condition of Object.values(CONDITIONS_MUST)) {
    await showAdvancedSearchDialog(page);
    await checkMustPaths(page, {
      condition: condition.name,
      field,
      searchCriteria: searchCriteria,
      index: 1,
    });
    await page.getByTestId('clear-filters').click();
  }

  // Check for Must Not conditions
  for (const condition of Object.values(CONDITIONS_MUST_NOT)) {
    await showAdvancedSearchDialog(page);
    await checkMustNotPaths(page, {
      condition: condition.name,
      field,
      searchCriteria: searchCriteria,
      index: 1,
    });
    await page.getByTestId('clear-filters').click();
  }

  // Don't run null path if it's present in skipConditions
  if (
    !field.skipConditions?.includes('isNull') ||
    !field.skipConditions?.includes('isNotNull')
  ) {
    // Check for Null and Not Null conditions
    for (const condition of Object.values(NULL_CONDITIONS)) {
      await showAdvancedSearchDialog(page);
      await checkNullPaths(page, {
        condition: condition.name,
        field,
        searchCriteria: undefined,
        index: 1,
      });
      await page.getByTestId('clear-filters').click();
    }
  }
};

export const checkAddRuleOrGroupWithOperator = async (
  page: Page,
  {
    field,
    operator,
    condition1,
    condition2,
    searchCriteria1,
    searchCriteria2,
  }: {
    field: EntityFields;
    operator: string;
    condition1: string;
    condition2: string;
    searchCriteria1: string;
    searchCriteria2: string;
  },
  isGroupTest = false
) => {
  await showAdvancedSearchDialog(page);
  await fillRule(page, {
    condition: condition1,
    field,
    searchCriteria: searchCriteria1,
    index: 1,
  });

  if (!isGroupTest) {
    await page.getByTestId('advanced-search-add-rule').nth(1).click();
  } else {
    await page.getByTestId('advanced-search-add-group').first().click();
  }

  await fillRule(page, {
    condition: condition2,
    field,
    searchCriteria: searchCriteria2,
    index: 2,
  });

  if (operator === 'OR') {
    await page
      .getByTestId('advanced-search-modal')
      .getByRole('button', { name: 'Or' })
      .click();
  }

  const searchRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset&from=0&size=10*'
  );
  await page.getByTestId('apply-btn').click();

  // Since the OR operator with must not conditions will result in huge API response
  // with huge data, checking the required criteria might not be present on first page
  // Hence, checking the criteria only for AND operator
  if (field.id !== 'Column' && operator === 'AND') {
    const res = await searchRes;
    const json = await res.json();
    const hits = json.hits.hits;

    expect(JSON.stringify(hits)).toContain(searchCriteria1);
    expect(JSON.stringify(hits)).not.toContain(searchCriteria2);
  }
};

export const runRuleGroupTests = async (
  page: Page,
  field: EntityFields,
  operator: string,
  isGroupTest: boolean,
  searchCriteria: Record<string, string[]>
) => {
  const searchCriteria1 = searchCriteria[field.name][0];
  const searchCriteria2 = searchCriteria[field.name][1];

  const testCases = [
    {
      condition1: CONDITIONS_MUST.equalTo.name,
      condition2: CONDITIONS_MUST_NOT.notEqualTo.name,
    },
    {
      condition1: CONDITIONS_MUST.contains.name,
      condition2: CONDITIONS_MUST_NOT.notContains.name,
    },
    {
      condition1: CONDITIONS_MUST.anyIn.name,
      condition2: CONDITIONS_MUST_NOT.notIn.name,
    },
  ];

  for (const { condition1, condition2 } of testCases) {
    await checkAddRuleOrGroupWithOperator(
      page,
      {
        field,
        operator,
        condition1,
        condition2,
        searchCriteria1,
        searchCriteria2,
      },
      isGroupTest
    );
    await page.getByTestId('clear-filters').click();
  }
};

export const runRuleGroupTestsWithNonExistingValue = async (page: Page) => {
  await showAdvancedSearchDialog(page);
  const ruleLocator = page.locator('.rule').nth(0);

  // Perform click on rule field
  await selectOption(
    page,
    ruleLocator.locator('.rule--field .ant-select'),
    'Database'
  );
  await selectOption(
    page,
    ruleLocator.locator('.rule--operator .ant-select'),
    '=='
  );

  const inputElement = ruleLocator.locator(
    '.rule--widget--SELECT .ant-select-selection-search-input'
  );
  await inputElement.fill('non-existing-value');
  const dropdownText = page.locator('.ant-select-item-empty');

  await expect(dropdownText).toContainText('Loading...');

  await page.waitForTimeout(1000);

  await expect(dropdownText).not.toContainText('Loading...');
};
