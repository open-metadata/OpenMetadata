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
import { expect } from '@playwright/test';
import { Page } from 'playwright';

export const searchAndClickOnOption = async (
  page: Page,
  filter: { key: string; label: string; value?: string },
  checkedAfterClick: boolean
) => {
  let testId = (filter.value ?? '').toLowerCase();
  // Filtering for tiers is done on client side, so no API call will be triggered
  if (filter.key !== 'tier.tagFQN') {
    const searchRes = page.waitForResponse(
      `/api/v1/search/aggregate?index=dataAsset&field=${filter.key}**`
    );

    await page.fill('[data-testid="search-input"]', filter.value ?? '');
    await searchRes;
  } else {
    testId = filter.value ?? '';
  }

  await page.waitForSelector(`[data-testid="${testId}"]`);
  await page.click(`[data-testid="${testId}"]`);
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
                          [filter.key]:
                            filter.key === 'tier.tagFQN'
                              ? filter.value
                              : filter.value.toLowerCase(),
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

  const queryRes = page.waitForResponse(querySearchURL);
  await page.click('[data-testid="update-btn"]');
  const queryResponseData = await queryRes;
  const request = await queryResponseData.request();

  const queryParams = request.url().split('?')[1];
  const queryParamsObj = new URLSearchParams(queryParams);

  const queryParamValue = queryParamsObj.get('query_filter');
  const isQueryFilterPresent = queryParamValue === queryFilter;

  expect(isQueryFilterPresent).toBeTruthy();

  if (clearFilter) {
    await page.click(`[data-testid="clear-filters"]`);
  }
};

export const checkCheckboxStatus = async (
  page: Page,
  boxId: string,
  isChecked: boolean
) => {
  const checkbox = await page.getByTestId(boxId);
  const isCheckedOnPage = await checkbox.isChecked();

  await expect(isCheckedOnPage).toEqual(isChecked);
};

export const selectDataAssetFilter = async (
  page: Page,
  filterValue: string
) => {
  await page.getByRole('button', { name: 'Data Assets' }).click();
  await page.getByTestId(`${filterValue}-checkbox`).check();
  await page.getByTestId('update-btn').click();
};
