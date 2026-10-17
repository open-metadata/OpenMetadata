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
import { expect, type Locator, type Page } from '@playwright/test';
import { chooseSelectOption } from './common';
import { waitForLandingPageWidget } from './customizeLandingPage';

/**
 * Picks an option from a topic card's filter, a core `Select`: options carry
 * their value as a test id, and choosing one closes the list on its own.
 */
export const selectTopicCardFilterOption = async (
  page: Page,
  widget: Locator,
  filterTestId: string,
  optionValue: string
) => {
  await chooseSelectOption(
    widget.getByTestId(filterTestId),
    page.getByRole('listbox').getByTestId(optionValue)
  );
};

/**
 * The Data Products card sorts the rows it already holds rather than re-querying
 * — the widget fetches once and reorders in memory. So the assertion is the
 * rendered order, not a search request with a `sort_field`; there is no request
 * to wait for, and waiting for one is how this check would hang.
 */
export const verifyDataProductsFilters = async (
  page: Page,
  widgetKey: string
) => {
  const widget = await waitForLandingPageWidget(page, widgetKey);

  await expect(widget.getByTestId('data-product-rows')).toBeVisible();

  await selectTopicCardFilterOption(
    page,
    widget,
    'data-product-sort-filter',
    'alphabetical'
  );

  const names = widget.getByTestId('data-product-name');

  // Poll rather than read once: the reorder is a React re-render, so a single
  // read can still observe the pre-sort order.
  await expect
    .poll(async () => {
      const rendered = await names.allInnerTexts();

      return (
        rendered.length > 1 &&
        rendered.every(
          (name, index) =>
            index === 0 || rendered[index - 1].localeCompare(name) <= 0
        )
      );
    })
    .toBe(true);
};
