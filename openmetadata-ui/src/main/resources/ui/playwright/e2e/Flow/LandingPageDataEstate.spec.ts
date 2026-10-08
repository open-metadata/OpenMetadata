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
import { expect } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { redirectToHomePage } from '../../utils/common';
import { waitForLandingPageWidget } from '../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { selectTopicCardFilterOption } from '../../utils/widgetFilters';
import { test } from '../fixtures/pages';

const DATA_ESTATE_KEY = 'KnowledgePanel.DataEstate';

/**
 * Entity types the card must never list under "by connector".
 *
 * The breakdown used to be read off the `total_data_assets` data-insight
 * chart, whose group dimension is the entity type — so the card printed
 * `table 800`, `chart 120`, `databaseSchema 83` beneath a "BY CONNECTOR"
 * heading. The service dimension exists only on the search aggregation, which
 * is where `useDataEstate` reads it from now. These names reappearing is that
 * regression returning, and nothing else in the suite would catch it.
 */
const ENTITY_TYPE_NAMES = [
  'table',
  'chart',
  'database',
  'databaseSchema',
  'dashboard',
  'dashboardDataModel',
  'storedProcedure',
  'topic',
  'metric',
];

test.describe('Landing page data estate', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
  });

  test('reports the estate size and what it is made of', async ({ page }) => {
    const widget = await waitForLandingPageWidget(page, DATA_ESTATE_KEY);

    // A seeded estate always has assets, so the total is a number rather than
    // the empty state.
    await expect(widget.getByTestId('data-estate-total')).toBeVisible();
    await expect(widget.getByTestId('data-estate-total')).not.toBeEmpty();

    const breakdown = widget.getByTestId('connector-breakdown');

    await expect(breakdown).toBeVisible();
    await expect(breakdown.getByTestId('connector-entry')).not.toHaveCount(0);
  });

  test('splits the estate by connector, not by entity type', async ({
    page,
  }) => {
    const widget = await waitForLandingPageWidget(page, DATA_ESTATE_KEY);
    const names = widget
      .getByTestId('connector-breakdown')
      .getByTestId('connector-name');

    await expect(names).not.toHaveCount(0);

    // Compared case-insensitively: the card runs service types through
    // `getFormattedDataAssetServiceType`, so a real connector reads `Big Query`
    // while the entity type it used to show reads `databaseSchema`. Polled
    // rather than read once — the legend fills from a search aggregation, so a
    // single read can observe the list mid-render.
    const entityTypes = ENTITY_TYPE_NAMES.map((name) => name.toLowerCase());

    await expect
      .poll(async () =>
        (await names.allInnerTexts())
          .map((name) => name.trim().toLowerCase())
          .filter((name) => entityTypes.includes(name))
      )
      .toEqual([]);
  });

  test('every connector it lists carries a count', async ({ page }) => {
    const widget = await waitForLandingPageWidget(page, DATA_ESTATE_KEY);
    const breakdown = widget.getByTestId('connector-breakdown');

    await expect(breakdown.getByTestId('connector-name')).not.toHaveCount(0);

    // A legend entry without its count is the failure mode of the share bar:
    // the segment still renders, so the bar looks right while the number that
    // makes it readable is missing.
    const names = await breakdown.getByTestId('connector-name').count();

    await expect(breakdown.getByTestId('connector-count')).toHaveCount(names);
  });

  // The range drives the fetch, not just the label: totals delta and the
  // coverage trend are both measured over it. The connector split deliberately
  // is not — it is a live count — so it has to survive the switch unchanged.
  test('widening the range keeps the estate on screen', async ({ page }) => {
    const widget = await waitForLandingPageWidget(page, DATA_ESTATE_KEY);

    await expect(widget.getByTestId('data-estate-total')).toBeVisible();

    const before = await widget
      .getByTestId('connector-breakdown')
      .getByTestId('connector-name')
      .allInnerTexts();

    await selectTopicCardFilterOption(
      page,
      widget,
      'data-estate-window-filter',
      '90'
    );

    await waitForAllLoadersToDisappear(page);

    await expect(widget.getByTestId('data-estate-total')).toBeVisible();
    await expect(widget.getByTestId('data-estate-total')).not.toBeEmpty();

    await expect(
      widget.getByTestId('connector-breakdown').getByTestId('connector-name')
    ).toHaveText(before);
  });
});
