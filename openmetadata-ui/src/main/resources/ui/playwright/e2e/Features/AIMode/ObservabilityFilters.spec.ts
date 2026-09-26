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

/**
 * Filter-control behaviour on the AI-mode Observability pages: whether a picker
 * dismisses itself, and whether the way back to "unfiltered" stays reachable.
 *
 * Layout invariants live in `ObservabilityLayout.spec.ts`; page
 * rendering and navigation in `Observability.spec.ts`.
 */

import { expect, test } from '@playwright/test';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { enableAiAppMode } from '../../Utils/appMode';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('AI mode Observability — filters', () => {
  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
  });

  /**
   * `UserTeamSelectableList` spreads `popoverProps` onto its Popover after its
   * own `open`, so the chip controlling `open` owns the close too — otherwise
   * the picker's internal dismiss drives nothing and it stays on screen after a
   * selection.
   */
  test('the owner picker closes once a selection is committed', async ({
    page,
  }) => {
    await page.goto('/observability/data-quality', {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);

    const ownerFilter = page.getByTestId('search-dropdown-owner');
    // The rewritten UserTeamSelectableList popover no longer carries the
    // `.user-team-select-popover` class; its tab strip is the stable marker for
    // "the owner picker is open" (react-aria unmounts it once the popover shuts).
    const ownerPopover = page.getByTestId('select-owner-tabs');
    await expect(ownerFilter).toBeVisible();

    // Under CI load, the data-quality page fires many
    // `/api/v1/search/query` requests on mount — the main test-case
    // list plus one per sibling filter dropdown (glossaryTerm,
    // dataProduct, tag, …). Their responses trickle in for a beat
    // after `waitForAllLoadersToDisappear` returns, each one
    // re-rendering the filter bar. A click that lands mid-remount
    // opens the picker against a stale ancestor and the popover
    // flickers away as the bar rebuilds.
    //
    // Waiting for a specific response is fragile (which of the N
    // fetches counts as "settled" depends on installed plugins).
    // Instead, retry the click-and-open pair until the popover
    // survives long enough to interact with. `expect.toPass`
    // re-runs its body on failure, so a flickered-closed popover
    // just triggers another click.
    await expect(async () => {
      await ownerFilter.click();
      await expect(ownerPopover).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000, intervals: [500, 1000, 2000] });

    // eslint-disable-next-line om-playwright/no-positional-locator -- any owner proves the picker commits and closes; which user the seeded env returns is irrelevant
    const firstOwner = page.getByTestId('owner-option').first();

    await expect(firstOwner).toBeVisible();
    await firstOwner.click();

    await expect(ownerPopover).toBeHidden();
    await expect(page.getByTestId('search-dropdown-owner')).toContainText('1');
  });

  /**
   * `label.all` is the Select's placeholder, which renders only while nothing is
   * picked — so without a real entry the option vanishes the moment a filter has
   * a value and the filter can never be cleared from the dropdown.
   */
  test('the Test Library keeps an All option once a filter has a value', async ({
    page,
  }) => {
    await page.goto('/observability/test-library', {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);

    const platforms = page.getByRole('button', { name: 'Test Platforms' });

    await platforms.click();
    await expect(
      page.getByRole('option', { name: 'All', exact: true })
    ).toBeVisible();

    await page.getByRole('option', { name: 'Deequ', exact: true }).click();

    await expect(page).toHaveURL(/testPlatforms=Deequ/);
    await expect(platforms).toContainText('Deequ');

    await platforms.click();

    // The regression: with All as a placeholder only, this option was gone.
    const allOption = page.getByRole('option', { name: 'All', exact: true });

    await expect(allOption).toBeVisible();
    await allOption.click();

    await expect(page).not.toHaveURL(/testPlatforms=/);
    await expect(platforms).toContainText('All');
  });
});
