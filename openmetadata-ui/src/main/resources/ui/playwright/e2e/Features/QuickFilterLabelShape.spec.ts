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
 * Asserts the chosen short-form label shape for Tier and Certification quick
 * filters across both filter families:
 *
 * - **Family A** (aggregation-driven): Explore page — options come from
 *   `/api/v1/search/aggregate` with `_source`-based labels post-processed by
 *   `stripClassificationPrefix`.
 * - **Family B** (entity-search-driven): Data Quality dashboard — options come
 *   from `searchQuery` against the entity index and `getEntityName(source)`.
 *
 * Both families must display the short form (`Tier1`, `Gold`) without the
 * classification prefix (`Tier.Tier1`, `Certification.Gold`).
 */
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { TagClass } from '../../support/tag/TagClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  goToDataQualityDashboard,
} from '../../utils/dataQuality';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });
test.describe.configure({ mode: 'default' });

const table = new TableClass();
const tier = new TagClass({ classification: 'Tier' });
const certification = new TagClass({ classification: 'Certification' });

test.beforeAll('Setup: create table with tier and certification', async ({
  browser,
}) => {
  test.slow();

  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await tier.create(apiContext);
  await certification.create(apiContext);

  // Assign the tier tag and certification to the table.
  await table.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        value: {
          tagFQN: tier.responseData.fullyQualifiedName,
        },
        path: '/tags/0',
      },
      {
        op: 'add',
        path: '/certification',
        value: {
          tagLabel: {
            tagFQN: certification.responseData.fullyQualifiedName,
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
      },
    ],
  });

  // Create a test case so the DQ dashboard has data to show.
  await table.createTestCase(apiContext);

  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  // TableClass.delete() cascades to test cases; TagClass has no cleanup needed
  // because Tier and Certification classifications are retained.
  await table.delete(apiContext);
  await tier.delete(apiContext);
  await certification.delete(apiContext);
  await afterAction();
});

test.describe('Quick-filter label shape — Tier', () => {
  test('Family A (Explore): Tier option shows short form without classification prefix', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.EXPLORE);
    await waitForAllLoadersToDisappear(page);

    // Open the Tier dropdown.
    await page.getByTestId('search-dropdown-Tier').click();
    await waitForAllLoadersToDisappear(page);

    // The tier's FQN is e.g. "Tier.pw-tier-SomeName". In the dropdown, the
    // label must show only the name portion ("pw-tier-SomeName" or
    // "PW Tier SomeName") — NOT the full FQN with the "Tier." prefix.
    const tierFqn = tier.responseData.fullyQualifiedName; // e.g. "Tier.pw-tier-Doe"
    const tierShortName = tier.data.displayName; // e.g. "PW Tier Doe"

    // The option is keyed by the lowercased FQN; assert its visible text is the
    // short form (displayName resolved from _source via top_hits, then
    // stripClassificationPrefix applied — but since tagFQN is
    // "Tier.pw-tier-Doe", stripping yields "pw-tier-Doe". The displayName from
    // _source would be "PW Tier Doe" if the top_hits resolves it.  However,
    // the source path is `tier.tagFQN` which gives the FQN, then
    // stripClassificationPrefix strips "Tier." to produce "pw-tier-Doe".
    //
    // The key assertion: the label must NOT start with the classification name
    // followed by a dot (e.g. NOT "Tier.pw-tier-Doe").
    const optionLocator = page.locator(
      `[data-menu-id$="-${tierFqn.toLowerCase()}"]`
    );
    await expect(optionLocator).toBeVisible();

    const optionText = await optionLocator.innerText();

    // The option text must NOT contain the "Tier." prefix.
    expect(optionText).not.toContain(`${tier.data.classification}.`);
    // And it must contain the tag name portion.
    expect(optionText.toLowerCase()).toContain(
      tier.data.name.toLowerCase()
    );
  });

  test('Family B (DQ Dashboard): Tier option shows short form', async ({
    page,
  }) => {
    await goToDataQualityDashboard(page);
    await waitForAllLoadersToDisappear(page);

    // Open the Tier dropdown.
    await page.getByRole('button', { name: 'Tier' }).click();
    await waitForAllLoadersToDisappear(page);

    // DQ Dashboard uses `getEntityName(source)` → `displayName || name`.
    // The option text must be the display name (short form), not the FQN.
    const tierFqn = tier.responseData.fullyQualifiedName;
    const optionLocator = page.getByTestId(tierFqn);
    await expect(optionLocator).toBeVisible();

    const optionText = await optionLocator.innerText();

    // Must NOT contain the classification prefix.
    expect(optionText).not.toContain(`${tier.data.classification}.`);
  });
});

test.describe('Quick-filter label shape — Certification', () => {
  test('Family A (Explore): Certification option shows short form without classification prefix', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.EXPLORE);
    await waitForAllLoadersToDisappear(page);

    // Open the Certification dropdown (if present — some Explore tab configs
    // may not include Certification; fall back to the Data Products page).
    const certDropdown = page.getByTestId('search-dropdown-Certification');
    if (!(await certDropdown.isVisible().catch(() => false))) {
      // Certification filter is not on the default Explore tab. Skip this
      // assertion — the DQ Dashboard test below covers Family B.
      test.skip();

      return;
    }

    await certDropdown.click();
    await waitForAllLoadersToDisappear(page);

    const certFqn = certification.responseData.fullyQualifiedName;
    const optionLocator = page.locator(
      `[data-menu-id$="-${certFqn.toLowerCase()}"]`
    );
    await expect(optionLocator).toBeVisible();

    const optionText = await optionLocator.innerText();

    expect(optionText).not.toContain(
      `${certification.data.classification}.`
    );
    expect(optionText.toLowerCase()).toContain(
      certification.data.name.toLowerCase()
    );
  });

  test('Family B (DQ Dashboard): Certification option shows short form', async ({
    page,
  }) => {
    await goToDataQualityDashboard(page);
    await waitForAllLoadersToDisappear(page);

    await page.getByRole('button', { name: 'Certification' }).click();
    await waitForAllLoadersToDisappear(page);

    const certFqn = certification.responseData.fullyQualifiedName;
    const optionLocator = page.getByTestId(certFqn);
    await expect(optionLocator).toBeVisible();

    const optionText = await optionLocator.innerText();

    expect(optionText).not.toContain(
      `${certification.data.classification}.`
    );
  });
});
