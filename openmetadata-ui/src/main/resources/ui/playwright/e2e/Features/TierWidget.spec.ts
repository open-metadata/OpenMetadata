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
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { addTierWidget } from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { closeTierDropdown } from '../../utils/tier';

test.use({ storageState: 'playwright/.auth/admin.json' });

let table: TableClass;

test.describe('TierWidget stale state regression', () => {
  test.beforeAll(async ({ browser }) => {
    table = new TableClass();
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('TierWidget stale-state regression', async ({ page }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);

    await test.step('Persisted tier stays selected after dismissing the picker', async () => {
      // Set Tier1 as the starting state.
      await addTierWidget(page, 'Tier1', 'tables', true);

      // Open the editor and dismiss it without picking a tier.
      // Tier tags are cached from addTierWidget above, so no API call fires here.
      await page.getByTestId('edit-tier').click();
      await page.getByTestId('drop-down-menu').waitFor({ state: 'visible' });
      await waitForAllLoadersToDisappear(page);
      await closeTierDropdown(page);

      // Reopen — tier tags are already cached so no API call fires; skip the
      // response wait that openTierDropdown uses and go straight to the UI signal.
      await page.getByTestId('edit-tier').click();
      await page.getByTestId('drop-down-menu').waitFor({ state: 'visible' });
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('drop-down-menu').getByTestId('Tier.Tier1')
      ).toBeChecked();
      await expect(
        page.getByTestId('drop-down-menu').getByTestId('Tier.Tier2')
      ).not.toBeChecked();

      await closeTierDropdown(page);
    });

    await test.step('Radio shows newly saved tier on reopen after a successful save', async () => {
      // Tier1 is still set from the step above; save Tier2.
      await addTierWidget(page, 'Tier2', 'tables', true);

      // Reopen the editor — should show Tier2, not the stale Tier1.
      await page.getByTestId('edit-tier').click();
      await page.getByTestId('drop-down-menu').waitFor({ state: 'visible' });
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('drop-down-menu').getByTestId('Tier.Tier2')
      ).toBeChecked();
      await expect(
        page.getByTestId('drop-down-menu').getByTestId('Tier.Tier1')
      ).not.toBeChecked();

      await closeTierDropdown(page);
    });
  });
});
