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
import { EXPECTED_BUCKETS } from '../constant/explore';
import { getApiContext } from './common';

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
  if (filter.key !== 'tier.tagFQN') {
    const searchRes = page.waitForResponse(
      `/api/v1/search/aggregate?index=dataAsset&field=${filter.key}**`
    );

    await page.fill('[data-testid="search-input"]', filter.value ?? '');
    await searchRes;
  } else {
    testId = filter.value ?? '';
  }

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
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });
  await queryRes;

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
  const checkbox = await page.getByTestId(boxId);
  const isCheckedOnPage = await checkbox.isChecked();

  await expect(isCheckedOnPage).toEqual(isChecked);
};

export const selectDataAssetFilter = async (
  page: Page,
  filterValue: string
) => {
  await page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset&from=0&size=0*'
  );
  await page.getByRole('button', { name: 'Data Assets' }).click();
  await page.getByTestId(`${filterValue}-checkbox`).check();
  await page.getByTestId('update-btn').click();
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
