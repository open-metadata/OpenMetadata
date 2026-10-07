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
import { ACTION_TIMEOUT } from '../../constant/common';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import {
  redirectToHomePage,
  waitForAntdPopupToSettle,
} from '../../utils/common';
import { waitForLandingPageWidget } from '../../utils/customizeLandingPage';
import {
  followEntity,
  validateFollowedEntityToWidget,
} from '../../utils/entity';
import { test } from './../../e2e/fixtures/pages';

test.describe('Verify RTL Layout for landing page', () => {
  const table = EntityDataClass.table1;

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);

    await page.getByTestId('language-selector-button').click();
    // The language menu is long enough that Ant's scaleY(0.8)->scaleY(1) entry
    // shifts every item; clicking mid-animation computes the point against the
    // scaled menu and lands on the option above Hebrew, so the handler never
    // runs and the `load` below waits out the hook.
    await waitForAntdPopupToSettle(page);
    await Promise.all([
      page.waitForEvent('load'),
      page.locator('.ant-dropdown:visible [data-menu-id*="-he-HE"]').click(),
    ]);
    // The landing header's own domain control went with the header; the navbar
    // one is on every page now, home included.
    await expect(page.getByTestId('domain-dropdown')).toBeVisible();
    // wait for translation to reflect in the UI. `toContainText`, as every
    // other spec driving this trigger uses: the testid is on the DomainSelect
    // root, which also carries the globe icon and its popover, so an exact
    // match is asserting more than the label.
    await expect(page.getByTestId('domain-dropdown')).toContainText(
      'כל הדומיינים',
      { timeout: ACTION_TIMEOUT }
    );
  });

  // Replaces a Data Assets widget check: that widget is excluded from the
  // landing page now, and nothing on the page exposes per-service tiles. The
  // Hebrew-locale assertion that mattered — the landing page's own widgets
  // render translated — moves onto the topic cards that took its place.
  test('Verify landing page widgets render under an RTL locale', async ({
    page,
  }) => {
    test.slow();

    const dataEstateWidget = await waitForLandingPageWidget(
      page,
      'KnowledgePanel.DataEstate'
    );

    await expect(dataEstateWidget).toContainText('נכסי הנתונים שלך');
    await expect(
      dataEstateWidget.getByTestId('data-estate-total')
    ).toBeVisible();
  });

  test('Verify Following widget functionality', async ({ page }) => {
    test.slow();
    await table.visitEntityPage(page);

    const entityName = table.entityResponseData?.['displayName'];

    await followEntity(page, table.endpoint, 'בטל מעקב');
    await validateFollowedEntityToWidget(page, entityName ?? '', true);
  });
});
